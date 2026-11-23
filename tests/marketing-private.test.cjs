'use strict';
const { test, before, after } = require('node:test');
const assert=require('node:assert/strict');
const {randomBytes,scryptSync}=require('node:crypto');
const {Readable}=require('node:stream');
const http=require('node:http');
process.env.NODE_ENV='test';
process.env.BLOB_STORE_ID='synthetic-test-store';
const password='Testing-Strong-Only-Password-2026!';
const salt=randomBytes(16);
process.env.MARKETING_ADMIN_SCRYPT=salt.toString('hex')+':'+scryptSync(password,salt,64,{N:16384,r:8,p:1}).toString('hex');
process.env.MARKETING_SESSION_SECRET=randomBytes(48).toString('base64url');
const storage=require('../lib/marketing-storage');
const bytes = new Map();
const video=Buffer.from('VIDEO-TEST-PRIVATE-MEDIA-PAYLOAD');
const caption=Buffer.from('WEBVTT\n\n00:00:00.000 --> 00:00:01.500\nNarration\n');
bytes.set('media/pet-v2-202611-a/master.mp4',video);
bytes.set('media/pet-v2-202611-a/captions.vtt',caption);
const mock={
  async list({prefix}){
    const blobs=[...bytes].filter(([key])=>key.startsWith(prefix)).map(([pathname,b])=>({pathname,size:b.length}));
    return {blobs,hasMore:false};
  },
  async get(path,opts){
    const original=bytes.get(path);
    if(!original)return null;
    let b=original;
    let statusCode=200;
    const headers = new Headers({'content-type':path.endsWith('mp4')?'video/mp4':'text/vtt'});
    if(opts.headers?.Range){
      const m=opts.headers.Range.match(/^bytes=(\d+)-(\d*)$/);
      if(!m)throw new Error('wrong range');
      const start=Number(m[1]);const end=Math.min(m[2]?Number(m[2]):b.length-1,b.length-1);
      b=b.subarray(start,end+1);statusCode=206;
      headers.set('Content-Range','bytes '+start+'-'+end+'/'+original.length);
    }
    headers.set('Content-Length',String(b.length));
    if(statusCode===206)statusCode=200; // SDK currently returns 200 with Content-Range.
    return {statusCode,stream:Readable.toWeb(Readable.from([b])),headers,blob:{size:original.length}};
  },
  async put(path,content,options){
    assert.equal(options.access,'private');
    assert(!bytes.has(path));
    bytes.set(path,Buffer.from(content));
    return {pathname:path};
  }
};
storage._setTestClient(mock);
const handler=require('../api/marketing');
let server,url,session;
before(async()=>{
 server=http.createServer((req,res)=>handler(req,res));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 url='http://127.0.0.1:'+server.address().port;
});
after(async()=>{await new Promise(resolve=>server.close(resolve))});
const req=(path,opts={})=>fetch(url+path,{redirect:'manual',...opts});
async function login(){
 const result=await req('/marketing/login',{method:'POST',headers:{Origin:url,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'admin',password}).toString()});
 assert.equal(result.status,303);
 return result.headers.get('set-cookie').split(';')[0];
}
test('authenticated one-player preview and private media streaming, with 206 support',async()=>{
 session=await login();
 const anon=await req('/marketing/media/pet-v2-202611-a');
 assert.equal(anon.status,303);
 const secured=await req('/marketing/preview/pet-v2-202611-a',{headers:{Cookie:session}});
 assert.equal(secured.status,200);
 const html=await secured.text();
 assert.equal((html.match(/<video\b/g)||[]).length,1);
 assert(html.includes('/marketing/media/pet-v2-202611-a'));
 assert(html.includes('/marketing/captions/pet-v2-202611-a'));
 const full=await req('/marketing/media/pet-v2-202611-a',{headers:{Cookie:session}});
 assert.equal(full.status,200);
 assert.deepEqual(Buffer.from(await full.arrayBuffer()),video);
 const partial=await req('/marketing/media/pet-v2-202611-a',{headers:{Cookie:session,Range:'bytes=0-5'}});
 assert.equal(partial.status,206);
 assert.equal(partial.headers.get('Content-Range'),'bytes 0-5/'+video.length);
 assert.deepEqual(Buffer.from(await partial.arrayBuffer()),video.subarray(0,6));
 const captions=await req('/marketing/captions/pet-v2-202611-a',{headers:{Cookie:session}});
 assert.equal(captions.status,200);assert.equal(await captions.text(),caption.toString());
});
test('review persisted as immutable private record and reflected after new request',async()=>{
 session ||= await login();
 const body=new URLSearchParams({decision:'REWORK_REQUIRED',note:'<script>no</script> Please enlarge the captions.'}).toString();
 const posted=await req('/marketing/review/pet-v2-202611-a',{method:'POST',headers:{Cookie:session,Origin:url,'Content-Type':'application/x-www-form-urlencoded'},body});
 assert.equal(posted.status,303);
 assert.equal(posted.headers.get('Location'),'/marketing/preview/pet-v2-202611-a?saved=1');
 const files=[...bytes.keys()].filter(k=>k.startsWith('reviews/pet-v2-202611-a/'));
 assert.equal(files.length,1);
 const review=JSON.parse(bytes.get(files[0]).toString());
 assert.equal(review.status,'REWORK_REQUIRED');
 assert.equal(review.publicationAuthorized,false);
 assert.equal(review.note,'<script>no</script> Please enlarge the captions.');
 const detail=await req('/marketing/preview/pet-v2-202611-a?saved=1',{headers:{Cookie:session}});
 const page=await detail.text();
 assert(page.includes('Decisão gravada'));
 assert(!page.includes('<script>no</script>'));
 assert(page.includes('&lt;script&gt;'));
 const status=await req('/marketing/status.json',{headers:{Cookie:session}});
 const json=await status.json();
 assert.equal(json.previews.find(x=>x.id==='pet-v2-202611-a').status,'REWORK_REQUIRED');
 assert.equal(json.previews.find(x=>x.id==='pet-v2-202611-a').media_attached,true);
 assert.equal(json.previews.filter(x=>x.media_attached).length,1);
});
test('disallowed review attempts are rejected and never change state',async()=>{
 const before=[...bytes].filter(([k])=>k.startsWith('reviews/')).length;
 const noLogin=await req('/marketing/review/pet-v2-202611-a',{method:'POST',headers:{Origin:url},body:'decision=CREATIVE_APPROVED'});
 assert.equal(noLogin.status,401);
 const noOrigin=await req('/marketing/review/pet-v2-202611-a',{method:'POST',headers:{Cookie:session},body:'decision=CREATIVE_APPROVED'});
 assert.equal(noOrigin.status,403);
 const wrongStatus=await req('/marketing/review/pet-v2-202611-a',{method:'POST',headers:{Cookie:session,Origin:url},body:'decision=PUBLISHED&note=approved'});
 assert.equal(wrongStatus.status,422);
 const unknown=await req('/marketing/review/pet-v2-202611-z',{method:'POST',headers:{Cookie:session,Origin:url},body:'decision=CREATIVE_APPROVED'});
 assert.equal(unknown.status,404);
 const after=[...bytes].filter(([k])=>k.startsWith('reviews/')).length;
 assert.equal(after,before);
});
