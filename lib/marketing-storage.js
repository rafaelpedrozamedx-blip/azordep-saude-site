'use strict';
let blobClient = require('@vercel/blob');
const { randomUUID } = require('node:crypto');
const { Readable } = require('node:stream');

const PREVIEW_PATTERN = /^[a-z0-9-]{4,90}$/;
const MEDIA_PATH = id => 'media/' + id + '/master.mp4';
const CAPTION_PATH = id => 'media/' + id + '/captions.vtt';
const VALID_DECISIONS = new Set(['CREATIVE_APPROVED', 'REWORK_REQUIRED', 'QA_BLOCKED']);

function configured() {
  return Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}
function validId(id) {
  return typeof id === 'string' && PREVIEW_PATTERN.test(id);
}
async function listAll(prefix) {
  const blobs = [];
  let cursor;
  for (let page = 0; page < 15; page++) {
    const result = await blobClient.list({ prefix, ...(cursor ? { cursor } : {}), limit: 1000 });
    blobs.push(...(result.blobs || []));
    if (!result.hasMore) return blobs;
    if (!result.cursor || result.cursor === cursor) throw new Error('Invalid blob pagination');
    cursor = result.cursor;
  }
  throw new Error('Too many blob pages');
}
async function mediaIndex() {
  const files = await listAll('media/');
  const index = new Map();
  for (const file of files) {
    const m = file.pathname.match(/^media\/([a-z0-9-]+)\/(master\.mp4|captions\.vtt)$/);
    if (!m || !validId(m[1])) continue;
    const obj = index.get(m[1]) || { video: false, caption: false, bytes: 0 };
    if (m[2] === 'master.mp4') {
      obj.video = true;
      obj.bytes = file.size || 0;
    } else {
      obj.caption = true;
    }
    index.set(m[1], obj);
  }
  return index;
}
async function loadJson(pathname) {
  const result = await blobClient.get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  const chunks = [];
  let total = 0;
  for await (const chunk of Readable.fromWeb(result.stream)) {
    total += chunk.length;
    if (total > 32 * 1024) throw new Error('Oversized review record');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function latestReviews(previewIds) {
  const allowed = new Set(previewIds);
  const files = await listAll('reviews/');
  const recent = new Map();
  for (const file of files) {
    const match = file.pathname.match(/^reviews\/([a-z0-9-]+)\/([0-9TZ-]+_[0-9a-f-]+)\.json$/);
    if (!match || !allowed.has(match[1])) continue;
    const prior = recent.get(match[1]);
    if (!prior || file.pathname > prior) recent.set(match[1], file.pathname);
  }
  const entries = await Promise.all([...recent].map(async ([id, path]) => [id, await loadJson(path)]));
  return new Map(entries.filter(([, value]) => value && VALID_DECISIONS.has(value.status)));
}
async function history(previewId) {
  const files = await listAll('reviews/' + previewId + '/');
  const chosen = files.filter(f => /^reviews\/[a-z0-9-]+\/[0-9TZ-]+_[0-9a-f-]+\.json$/.test(f.pathname))
    .sort((a,b) => a.pathname.localeCompare(b.pathname)).slice(-30).reverse();
  const result = await Promise.all(chosen.map(f => loadJson(f.pathname)));
  return result.filter(x => x && x.previewId === previewId && VALID_DECISIONS.has(x.status));
}
async function writeReview({previewId, status, note, previousStatus}) {
  if (!validId(previewId) || !VALID_DECISIONS.has(status) || typeof note !== 'string' || note.length > 1200) {
    throw new TypeError('Invalid review');
  }
  const time = new Date().toISOString();
  const uid = randomUUID();
  const pathname = 'reviews/' + previewId + '/' + time.replace(/[.:]/g,'-') + '_' + uid + '.json';
  const event = {
    eventId: uid, previewId, createdAt: time, actor: 'admin', status, previousStatus,
    note: note.trim().slice(0, 1200), publicationAuthorized: false, mediaApprovedForRelease: false
  };
  await blobClient.put(pathname, JSON.stringify(event), {
    access: 'private', contentType: 'application/json', addRandomSuffix: false,
    allowOverwrite: false, cacheControlMaxAge: 60
  });
  return event;
}
async function openMedia(previewId, kind, requestRange) {
  if (!validId(previewId) || !['video','caption'].includes(kind)) return null;
  const pathname = kind === 'video' ? MEDIA_PATH(previewId) : CAPTION_PATH(previewId);
  const options = {access:'private'};
  if (kind === 'video' && requestRange) {
    if (typeof requestRange !== 'string' || !/^bytes=\d*-\d*$/.test(requestRange) || requestRange.length > 50) {
      throw new TypeError('Invalid media range');
    }
    options.headers = { Range: requestRange };
  }
  return blobClient.get(pathname, options);
}
module.exports = {
  configured, validId, mediaIndex, latestReviews, history, writeReview, openMedia,
  MEDIA_PATH, CAPTION_PATH, VALID_DECISIONS,
  _setTestClient: value => { if (process.env.NODE_ENV !== 'test') throw new Error('Test-only driver'); blobClient = value; }
};
