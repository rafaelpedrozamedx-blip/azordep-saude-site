'use strict';

/*
 * AZORDEP /marketing administrative gateway.
 * No unpublished media ships with the public GitHub repository.
 * Credentials are configured only in the Vercel runtime environment.
 */

const { randomBytes, createHmac, scryptSync, timingSafeEqual } = require('node:crypto');
const { Readable } = require('node:stream');
const storage = require('../lib/marketing-storage');

const USERNAME = 'admin';
const SESSION_COOKIE = '__Host-azordep-marketing';
const SESSION_SECONDS = 8 * 60 * 60;
const STATUSES = new Set(['REWORK_REQUIRED', 'CREATIVE_APPROVED', 'QA_BLOCKED', 'READY_FOR_REVIEW', 'SCHEDULED', 'PUBLISHED']);

const PROJECTS = Object.freeze([
  { id: 'copiloto', name: 'AZORDEP Copiloto', image: '/assets/projects/copiloto-official.jpg', message: 'Revisar realismo, interface real, ritmo, legendas grandes e narração natural.' },
  { id: 'iniciado', name: 'O Iniciado', image: '/assets/projects/o-iniciado-cover.png', message: 'Roteiro de aventura e mistério, capa oficial e visual cinematográfico, sem estética de autoajuda.' },
  { id: 'rmf', name: 'Residência Médica Fácil', image: '/assets/projects/rmf-official.png', message: 'Demonstração educacional realista, conteúdo médico conferido e legendas legíveis.' },
  { id: 'pet', name: 'Pet & Place', image: '/assets/projects/pet-place-official.png', message: 'Aprovação criativa concedida em 23/11/2026; ainda verificar áudio integral e operação comercial.' }
]);

const ITEMS = Object.freeze([
  ...['23','25','27','29'].map(d => ({
    id: 'copiloto-202611' + d, project: 'copiloto', title: 'Reel Copiloto · ' + d + '/11', status: 'REWORK_REQUIRED',
    qa: 'Reprovado na revisão de direção visual: refazer com identidade oficial, cenas realistas, movimento e captions em bom tamanho.', media: null
  })),
  ...['23','25','27','29'].map(d => ({
    id: 'iniciado-202611' + d, project: 'iniciado', title: 'Reel O Iniciado · ' + d + '/11', status: 'REWORK_REQUIRED',
    qa: 'Reformular como romance de aventura e mistério, com narrativa cinematográfica e identidade editorial oficial.', media: null
  })),
  ...['23','25','27','29'].map(d => ({
    id: 'rmf-202611' + d, project: 'rmf', title: 'Reel Residência Médica Fácil · ' + d + '/11', status: 'REWORK_REQUIRED',
    qa: 'Recriar com exemplos corretos, visual realista, textos grandes e efeitos de movimento significativos.', media: null
  })),
  ...['a','b','c'].map((id, i) => ({
    id: 'pet-v2-202611-' + id, project: 'pet',
    title: ['The Cleaner Home','The Beautiful Cat Corner','Play, Explore, Repeat'][i],
    status: 'CREATIVE_APPROVED', qa: 'Aprovação criativa de Rafael; QA audiovisual completo e checkout/CJ ainda separados.', media: null
  }))
]);

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function secretsReady() {
  return Boolean(
    process.env.MARKETING_ADMIN_SCRYPT &&
    process.env.MARKETING_SESSION_SECRET &&
    process.env.MARKETING_SESSION_SECRET.length >= 43 &&
    /^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(process.env.MARKETING_ADMIN_SCRYPT)
  );
}

function verifyPassword(password) {
  if (!secretsReady() || typeof password !== 'string' || password.length > 1024 || password.length < 12 ||
      ['admin', 'password', '123456'].includes(password.toLowerCase())) return false;
  try {
    const [salt, expected] = process.env.MARKETING_ADMIN_SCRYPT.split(':');
    const hashed = scryptSync(password, Buffer.from(salt, 'hex'), 64, { N: 16384, r: 8, p: 1 });
    return timingSafeEqual(hashed, Buffer.from(expected, 'hex'));
  } catch (_) { return false; }
}

function mac(data) {
  return createHmac('sha256', process.env.MARKETING_SESSION_SECRET).update(data).digest('base64url');
}
function issueSession() {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = 'v1.' + exp + '.' + randomBytes(18).toString('base64url');
  return payload + '.' + mac(payload);
}
function verifySession(cookie) {
  if (!secretsReady() || typeof cookie !== 'string' || cookie.length > 512) return false;
  const match = cookie.match(/^v1\.(\d{10})\.([a-zA-Z0-9_-]{24})\.([a-zA-Z0-9_-]{43})$/);
  if (!match) return false;
  const exp = Number(match[1]);
  if (!Number.isInteger(exp) || exp < Date.now()/1000 || exp > Date.now()/1000 + SESSION_SECONDS + 90) return false;
  const supplied = Buffer.from(match[3]);
  const expected = Buffer.from(mac('v1.' + match[1] + '.' + match[2]));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function getCookies(raw) {
  const out = Object.create(null);
  for (const pair of String(raw || '').split(';')) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const name = pair.slice(0,idx).trim();
    const value = pair.slice(idx+1).trim();
    if (name && !Object.prototype.hasOwnProperty.call(out,name)) out[name]=value;
  }
  return out;
}
function requestRoute(req) {
  const u = new URL(req.url || '/marketing', 'https://www.azordepsaude.com.br');
  if (u.searchParams.has('route')) return u.searchParams.get('route').replace(/^\/+|\/+$/g,'');
  const p = u.pathname.replace(/^\/marketing\/?/,'');
  return p.replace(/^\/+|\/+$/g,'');
}
function baseHeaders(type='text/html; charset=utf-8') {
  return {
    'Content-Type': type,
    'Cache-Control': 'private, no-store, max-age=0',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; connect-src 'self'"
  };
}
function respond(res, status, body, type='text/html; charset=utf-8', additional={}) {
  res.writeHead(status,{...baseHeaders(type),...additional});
  res.end(body);
}
function page(title, body) {
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + escapeHTML(title) + ' · AZORDEP Marketing</title><link rel="icon" type="image/svg+xml" href="/assets/logo-official.svg">' +
    '<style>:root{--navy:#0a2238;--gold:#c4a15b;--off:#fbfaf6;--pale:#eaf3f8}*{box-sizing:border-box}body{margin:0;background:var(--off);font:16px/1.5 Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:var(--navy)}.shell{max-width:1240px;margin:auto;padding:32px 22px 82px}.bar{display:flex;align-items:center;gap:18px;border-bottom:1px solid #c5d4d7;padding-bottom:19px}.brand{width:74px;height:74px;object-fit:contain}.eyebrow{letter-spacing:.17em;font-size:.77rem;text-transform:uppercase;color:#6b7681}h1,h2,h3{font-family:Georgia,serif;line-height:1.2}h1{font-size:clamp(31px,4vw,48px);margin:17px 0}h2{font-size:28px}.note{max-width:880px;color:#586778}.gate{max-width:500px;margin:7vh auto;background:#fff;border:1px solid #d4dada;padding:30px;border-radius:18px;box-shadow:0 16px 46px #001e3210}label{display:block;font-size:.87rem;margin:13px 0 6px}input{width:100%;font:inherit;padding:12px;border:1px solid #a7bac0;border-radius:7px}button,.btn{border:none;border-radius:8px;background:var(--navy);color:white;padding:11px 16px;font:inherit;cursor:pointer;display:inline-block;text-decoration:none;margin-top:15px}button:hover,.btn:hover{background:#234962}.projects{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:13px;margin:24px 0}.project{background:white;border:1px solid #e1e4e2;border-radius:12px;padding:16px}.project img{max-width:100%;width:85px;height:90px;object-fit:contain}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}.card{border:1px solid #d2dfe0;border-radius:12px;background:white;padding:17px}.card h3{font-size:19px}.meta{font-size:13px;color:#5c6872}.status{font-size:12px;font-weight:700;letter-spacing:.09em;color:#5d4c35}.warn{border-left:4px solid var(--gold);background:#f8f0e1;padding:13px 16px;margin:20px 0}.link{color:#145b7d;text-decoration:underline}form.logout{margin-left:auto}.logout button{background:transparent;color:#122d3f;border:1px solid #bccad0;margin:0}.small{font-size:13px;color:#536572}.actions{display:flex;flex-wrap:wrap;gap:10px}.actions a{padding:9px 13px;background:#e4eff0;border-radius:7px;color:#133b4d;text-decoration:none}@media(max-width:600px){.shell{padding:21px 15px}.bar{align-items:flex-start}.brand{width:56px;height:56px}.gate{padding:20px}}' +
    '</style></head><body>' + body + '</body></html>';
}
function header() {
  return '<header class="bar"><img class="brand" src="/assets/logo-official.svg" alt="Logo oficial AZORDEP"><div><div class="eyebrow">AZORDEP SAÚDE E TECNOLOGIA</div><strong>Central privada de marketing</strong></div>' +
    '<form class="logout" method="post" action="/marketing/logout"><button type="submit">Sair</button></form></header>';
}
function loginHTML(message='') {
  return page('Acesso administrativo',
    '<main class="shell"><div class="gate"><img class="brand" src="/assets/logo-official.svg" alt="AZORDEP"><div class="eyebrow">/MARKETING · ACESSO RESTRITO</div>' +
    '<h1>Entrar na central</h1><p class="note">Área de prévias e decisões editoriais. Usuário administrativo: <strong>admin</strong>.</p>' +
    (message?'<p role="alert" class="warn">'+escapeHTML(message)+'</p>':'') +
    '<form method="post" action="/marketing/login" autocomplete="on"><label for="username">Usuário</label><input id="username" name="username" value="admin" required autocomplete="username" maxlength="32">' +
    '<label for="password">Senha</label><input id="password" name="password" type="password" required autocomplete="current-password" maxlength="1024">' +
    '<button type="submit">Acessar prévias</button></form><p class="small">A senha pública “admin” está desabilitada por segurança. Configure uma senha forte no ambiente hospedado.</p></div></main>'
  );
}
function effectiveStatus(item, reviews) {
  const review = reviews.get(item.id);
  return review ? review.status : item.status;
}
function cardsFor(project, media, reviews) {
  return ITEMS.filter(x=>x.project===project).map(item => {
    const row = media.get(item.id) || {};
    const effective = effectiveStatus(item,reviews);
    return '<article class="card"><div class="status">'+escapeHTML(effective.replace(/_/g,' '))+'</div><h3>'+escapeHTML(item.title)+'</h3><p class="small">'+escapeHTML(item.qa)+'</p>' +
      '<p class="meta">Mídia: '+ (row.video ? 'vídeo privado disponível' : 'aguardando anexo') + (row.caption ? ' · legendas disponíveis' : '') + '</p>' +
      '<a class="link" href="/marketing/preview/'+encodeURIComponent(item.id)+'">Ver prévia e registrar decisão</a></article>';
  }).join('');
}
async function dashboard() {
  const [media, reviews] = storage.configured()
    ? await Promise.all([storage.mediaIndex(),storage.latestReviews(ITEMS.map(x=>x.id))])
    : [new Map(),new Map()];
  const projectCards = PROJECTS.map(project=>'<article class="project">'+
    (project.image?'<img src="'+project.image+'" alt="Identidade oficial de '+escapeHTML(project.name)+'">':'<div class="eyebrow">PET &amp; PLACE</div>')+
    '<h3>'+escapeHTML(project.name)+'</h3><p class="small">'+escapeHTML(project.message)+'</p></article>').join('');
  const sections = PROJECTS.map(project=>'<section id="'+project.id+'"><h2>'+escapeHTML(project.name)+'</h2><div class="cards">'+cardsFor(project.id,media,reviews)+'</div></section>').join('');
  const count = ITEMS.filter(x=>media.get(x.id)?.video).length;
  return page('Central de prévias',
    '<main class="shell">'+header()+
    '<div class="eyebrow" style="margin-top:26px">Fluxo editorial · 23 novembro 2026</div><h1>Prévias e aprovações</h1>' +
    '<p class="note">Central privada AZORDEP. Assista aos vídeos, revise legendas, registre sua aprovação ou solicite correções. Decisões editoriais não agendam publicações.</p>' +
    '<aside class="warn"><strong>'+count+' / '+ITEMS.length+' vídeos disponíveis em armazenamento privado.</strong> Os 12 Reels de Copiloto, O Iniciado e RMF continuam com reprovação visual até revisão. Pet &amp; Place tem aprovação criativa, mas checkout e QA comercial permanecem pendentes.</aside>'+
    '<div class="projects">'+projectCards+'</div>'+sections+
    '<p class="small">Fluxo: nova prévia → /marketing/preview/ID → QA → sua decisão persistida → programação autorizada separadamente → publicação comprovada.</p></main>'
  );
}
async function detail(item, saved=false) {
  const [media,events] = storage.configured()
    ? await Promise.all([storage.mediaIndex(),storage.history(item.id)])
    : [new Map(),[]];
  const row = media.get(item.id) || {};
  const status = events.length ? events[0].status : item.status;
  const source = '/marketing/media/'+encodeURIComponent(item.id);
  const captions = '/marketing/captions/'+encodeURIComponent(item.id);
  const player = row.video
    ? '<video controls playsinline preload="metadata" style="display:block;width:min(100%,420px);aspect-ratio:9/16;max-height:680px;background:#071b18;border-radius:12px" aria-label="Prévia '+escapeHTML(item.title)+'">'+
        '<source src="'+source+'" type="video/mp4">'+
        // The exported MP4s already contain burnt-in captions. An extra
        // VTT track doubles the subtitles, especially with default enabled.
        'Seu navegador não conseguiu reproduzir este vídeo.</video>'+
        '<p class="small">As legendas já estão integradas ao vídeo. O player não adiciona uma segunda camada.</p>'+
        (row.caption?'<p class="small"><a class="link" href="'+captions+'" target="_blank" rel="noopener">Consultar transcrição sincronizada (VTT)</a></p>':'')+
        '<p><a class="link" href="'+source+'" target="_blank" rel="noopener">Abrir MP4 isoladamente</a></p>'
    : '<div class="warn">Vídeo não anexado ao armazenamento privado. Registro editorial acessível, mas sem arquivo reproduzível.</div>';
  const notes = events.map(e=>'<li class="small"><strong>'+escapeHTML(e.status)+'</strong> · '+escapeHTML(e.createdAt||'')+
    (e.note?' — '+escapeHTML(e.note):'')+'</li>').join('');
  const form = '<form method="post" action="/marketing/review/'+encodeURIComponent(item.id)+'" class="card" style="max-width:640px">'+
    '<h2>Registrar decisão</h2><p class="small">A aprovação é somente criativa: não publica nem agenda o post. Registros são permanentes e sucessivos.</p>'+
    '<label for="note">Comentários e ajustes necessários</label><textarea id="note" name="note" maxlength="1200" rows="5" style="width:100%;border:1px solid #a7bac0;border-radius:8px;padding:12px;font:inherit" placeholder="Ex.: aumentar legenda, trocar cena genérica, revisar CTA"></textarea>'+
    '<div style="display:flex;gap:10px;flex-wrap:wrap">'+
    '<button type="submit" name="decision" value="CREATIVE_APPROVED">Aprovar criativo</button>'+
    '<button type="submit" name="decision" value="REWORK_REQUIRED" style="background:#7b3542">Solicitar correções</button>'+
    '<button type="submit" name="decision" value="QA_BLOCKED" style="background:#6d592a">Bloquear no QA</button>'+
    '</div></form>';
  return page(item.title,'<main class="shell">'+header()+'<p><a class="link" href="/marketing">Voltar à central</a></p>'+
    '<div class="eyebrow">'+escapeHTML(item.project.toUpperCase())+'</div><h1>'+escapeHTML(item.title)+'</h1>'+
    '<p class="status">'+escapeHTML(status)+'</p><div class="warn">'+escapeHTML(item.qa)+'</div>'+
    (saved?'<div class="warn" role="status">Decisão gravada no histórico privado.</div>':'')+
    player + form +
    '<h2>Histórico de decisões</h2>'+(events.length?'<ol>'+notes+'</ol>':'<p class="small">Ainda não há novas decisões gravadas para este criativo.</p>')+
    '<p class="small">URL canônica: https://www.azordepsaude.com.br/marketing/preview/'+encodeURIComponent(item.id)+'</p></main>');
}
async function mediaResponse(req,res,item,kind) {
  if (!storage.configured()) return respond(res,503,'Storage unavailable','text/plain; charset=utf-8');
  let result;
  try { result = await storage.openMedia(item.id,kind,req.headers.range); }
  catch (error) {
    if(error instanceof TypeError) return respond(res,416,'Invalid byte range','text/plain; charset=utf-8');
    throw error;
  }
  if (!result || !result.stream) return respond(res,404,'Media not available','text/plain; charset=utf-8');
  const h = {
    ...baseHeaders(kind==='video'?'video/mp4':'text/vtt; charset=utf-8'),
    'Content-Type':kind==='video'?'video/mp4':'text/vtt; charset=utf-8',
    'Accept-Ranges':'bytes',
    'Content-Disposition':'inline',
    'Cache-Control':'private, no-store'
  };
  for (const name of ['content-length','content-range','etag','last-modified']) {
    const value = result.headers?.get(name);
    if (value) h[name] = value;
  }
  if (result.blob?.size && !h['content-length'] && !req.headers.range) {
    h['Content-Length']=String(result.blob.size);
  }
  // Blob SDK currently reports statusCode 200 for ranged reads even when
  // content-range is present; preserve HTTP 206 for HTML5 video seeking.
  const partial = Boolean(req.headers.range && (h['content-range'] || h['Content-Range']));
  res.writeHead(partial || result.statusCode===206 ? 206 : 200,h);
  if(req.method==='HEAD') { result.stream.cancel?.();return res.end(); }
  const node = Readable.fromWeb(result.stream);
  node.on('error',()=>{ if(!res.headersSent)res.writeHead(502);res.destroy(); });
  node.pipe(res);
}
async function readBody(req) {
  if (req.body && typeof req.body === 'object') return new URLSearchParams(req.body).toString();
  if (typeof req.body === 'string') return req.body.slice(0,4097);
  return new Promise((resolve,reject)=>{
    let chunks = '';let bytes=0;
    req.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){reject(new Error('body too large'));req.destroy();return;}chunks+=chunk.toString('utf8');});
    req.on('end',()=>resolve(chunks));req.on('error',reject);
  });
}
function sourceMatches(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const u=new URL(origin);
    return (u.protocol==='https:' && ['azordepsaude.com.br','www.azordepsaude.com.br'].includes(u.hostname)) ||
      (u.protocol==='http:' && ['localhost','127.0.0.1'].includes(u.hostname) && process.env.NODE_ENV==='test');
  } catch (_) { return false; }
}

async function handler(req,res) {
  const route = requestRoute(req);
  const method=(req.method||'GET').toUpperCase();
  if (!secretsReady()) return respond(res,503,page('Configuração pendente',
    '<main class="shell"><h1>Central temporariamente indisponível</h1><p>Credenciais administrativas não configuradas no ambiente de produção.</p></main>'));
  if (method==='POST' && route==='login') {
    if (!sourceMatches(req)) return respond(res,403,page('Acesso negado','<main class="shell"><h1>Origem inválida</h1></main>'));
    let body;
    try { body=await readBody(req); } catch (_) {return respond(res,413,'Tamanho de formulário inválido.','text/plain; charset=utf-8');}
    const data=new URLSearchParams(body);
    const username=data.get('username'),password=data.get('password');
    if (username!==USERNAME || !verifyPassword(password)) return respond(res,401,loginHTML('Credenciais incorretas.'));
    const token=issueSession();
    return respond(res,303,'','text/plain; charset=utf-8',{
      'Location':'/marketing',
      'Set-Cookie':SESSION_COOKIE+'='+token+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='+SESSION_SECONDS
    });
  }
  if (method==='POST' && route==='logout') {
    if (!sourceMatches(req)) return respond(res,403,'Origem inválida.','text/plain; charset=utf-8');
    return respond(res,303,'','text/plain; charset=utf-8',{
      'Location':'/marketing',
      'Set-Cookie':SESSION_COOKIE+'=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0'
    });
  }
  const reviewMatch = route.match(/^review\/([a-z0-9-]+)$/);
  if (method==='POST' && reviewMatch) {
    if (!verifySession(getCookies(req.headers.cookie)[SESSION_COOKIE])) return respond(res,401,'Authentication required','text/plain; charset=utf-8');
    if (!sourceMatches(req)) return respond(res,403,'Origem inválida','text/plain; charset=utf-8');
    const item=ITEMS.find(x=>x.id===reviewMatch[1]);
    if (!item) return respond(res,404,'Unknown preview','text/plain; charset=utf-8');
    if (!storage.configured()) return respond(res,503,'Private storage unavailable','text/plain; charset=utf-8');
    let body;
    try { body=await readBody(req); } catch(_) {return respond(res,413,'Invalid review size','text/plain; charset=utf-8');}
    const values=new URLSearchParams(body);
    const status=values.get('decision');
    const note=values.get('note')||'';
    if (!storage.VALID_DECISIONS.has(status) || note.length>1200) return respond(res,422,'Invalid review','text/plain; charset=utf-8');
    try {
      const current=await storage.history(item.id);
      await storage.writeReview({previewId:item.id,status,note,previousStatus:current[0]?.status||item.status});
    } catch(error) {
      console.error('Review persistence failed:',error?.name||'unknown');
      return respond(res,503,'Review could not be saved. Try again.','text/plain; charset=utf-8');
    }
    return respond(res,303,'','text/plain; charset=utf-8',{'Location':'/marketing/preview/'+item.id+'?saved=1'});
  }
  if (!['GET','HEAD'].includes(method)) return respond(res,405,'Método não permitido.','text/plain; charset=utf-8',{'Allow':'GET, HEAD, POST'});
  if (!verifySession(getCookies(req.headers.cookie)[SESSION_COOKIE])) {
    if (route==='') return respond(res,200,method==='HEAD'?'':loginHTML());
    if (route==='status.json') return respond(res,401,'{"error":"authentication_required"}','application/json; charset=utf-8');
    return respond(res,303,'','text/plain; charset=utf-8',{'Location':'/marketing'});
  }
  if (route==='' || route==='dashboard') {
    try { return respond(res,200,method==='HEAD'?'':await dashboard()); }
    catch(error) {console.error('Dashboard blob read failed:',error?.name||'unknown');return respond(res,503,'Private storage temporarily unavailable','text/plain; charset=utf-8');}
  }
  if (route==='status.json') {
    try {
      const [media,reviews]=storage.configured()
        ? await Promise.all([storage.mediaIndex(),storage.latestReviews(ITEMS.map(x=>x.id))])
        : [new Map(),new Map()];
      return respond(res,200,method==='HEAD'?'':JSON.stringify({
        projects:PROJECTS.map(x=>({id:x.id,name:x.name})),
        previews:ITEMS.map(x=>({id:x.id,project:x.project,status:effectiveStatus(x,reviews),media_attached:!!media.get(x.id)?.video}))
      }), 'application/json; charset=utf-8');
    } catch(error) {console.error('Private status read failed:',error?.name||'unknown');return respond(res,503,'Status unavailable','text/plain; charset=utf-8');}
  }
  const mediaMatch=route.match(/^(media|captions)\/([a-z0-9-]+)$/);
  if (mediaMatch) {
    const item=ITEMS.find(x=>x.id===mediaMatch[2]);
    if(!item)return respond(res,404,'Unknown preview','text/plain; charset=utf-8');
    try {return await mediaResponse(req,res,item,mediaMatch[1]==='media'?'video':'caption');}
    catch(error){console.error('Private media unavailable:',error?.name||'unknown'); if(!res.headersSent)return respond(res,503,'Media unavailable','text/plain; charset=utf-8'); return res.destroy();}
  }
  const match=route.match(/^preview\/([a-z0-9-]+)$/);
  if (match) {
    const item=ITEMS.find(x=>x.id===match[1]);
    if (item) {
      try {
        const saved=new URL(req.url,'https://www.azordepsaude.com.br').searchParams.get('saved')==='1';
        return respond(res,200,method==='HEAD'?'':await detail(item,saved));
      } catch(error) {
        console.error('Private preview read failed:',error?.name||'unknown');
        return respond(res,503,'Preview unavailable','text/plain; charset=utf-8');
      }
    }
  }
  return respond(res,404,page('Não encontrado','<main class="shell"><h1>Prévia não encontrada</h1><a href="/marketing">Voltar</a></main>'));
}

module.exports=handler;
module.exports._test={verifyPassword, verifySession, secretsReady, requestRoute, ITEMS,PROJECTS,STATUSES};
