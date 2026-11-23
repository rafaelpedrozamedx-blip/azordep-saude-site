#!/usr/bin/env python3
"""One-time bounded, deduplicated upload of 15 approved-for-review candidate assets to private Blob."""
from pathlib import Path
import json,subprocess,hashlib,re,sys,os
home=Path.home()
site=home/'Downloads/AZORDEP_MARKETING_SITE_CANDIDATE/site'
root=home/'Downloads/AZORDEP_QA_WEEK_FINAIS'
pet=home/'Downloads/PET_PLACE_LAUNCH_V2_20_PRODUCTS'
j=json.loads((root/'PREVIEW_3_BRANDS_WEEK_MANIFEST_20261123.json').read_text())
uploads=[]
for record in j['videos']:
 slug=record['slug']
 found=re.fullmatch(r'(copiloto|livro|rmf)_(23|25|27|29)',slug)
 assert found,slug
 brand,day=found.groups()
 id={'copiloto':'copiloto','livro':'iniciado','rmf':'rmf'}[brand]+'-202611'+day
 uploads.append((id,root/record['video'],root/record['vtt']))
for letter in ['A','B','C']:
 id='pet-v2-202611-'+letter.lower()
 uploads.append((id,pet/'reels'/letter/(letter+'_AFONSO_NARRATED_9x16_MASTER.mp4'),pet/'reels'/letter/(letter+'_AFONSO_ENGLISH_SYNC.srt')))
assert len(uploads)==15 and len(set(x[0] for x in uploads))==15
for id,video,caption in uploads:
 assert video.is_file() and caption.is_file(),(id,video,caption)
 assert video.suffix=='.mp4'
 if caption.suffix=='.srt':
  s=caption.read_text()
  new=site/'private-media'/id/'captions.vtt'
  new.parent.mkdir(parents=True,exist_ok=True)
  new.write_text('WEBVTT\n\n'+re.sub(r'(\d\d:\d\d:\d\d),(\d\d\d)',r'\1.\2',s.strip())+'\n')
  caption=new
 data=video.stat().st_size
 assert data < 30*1024**2, (id,data)
total=sum(v.stat().st_size+c.stat().st_size for _,v,c in uploads)
print('FILES',len(uploads)*2,'VIDEOS',len(uploads),'TOTAL_MiB',round(total/1048576,1),flush=True)
assert total<230*1024**2,'STOP storage budget guard'
# Check current store contents before writing, avoiding duplicate effects across tool retries.
current=subprocess.run(['vercel','blob','list','--scope','rafaelpedrozamedx-2002'],capture_output=True,text=True,timeout=45,check=True)
existing=current.stdout+current.stderr
receipt=site.parent/'private_media_upload_receipt_20261123.json'
results=[]
for id,video,caption in uploads:
 for kind,source,ct in [('master.mp4',video,'video/mp4'),('captions.vtt',caption,'text/vtt')]:
  dest='media/'+id+'/'+kind
  if dest in existing:
   print('ALREADY_PRESENT',dest,flush=True)
   results.append({'id':id,'file':kind,'path':dest,'status':'PREEXISTING_NOT_REUPLOADED'})
   continue
  cmd=['vercel','blob','put',str(source),'--access','private','--pathname',dest,'--content-type',ct,'--scope','rafaelpedrozamedx-2002']
  p=subprocess.run(cmd,capture_output=True,text=True,timeout=180)
  if p.returncode:
   print('STOP_UPLOAD_FAILURE',dest,p.returncode, (p.stderr or p.stdout)[-300:].replace(str(home),'$HOME'),flush=True)
   receipt.write_text(json.dumps(results,indent=2))
   sys.exit(4)
  results.append({'id':id,'file':kind,'path':dest,'status':'UPLOADED','size':source.stat().st_size,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
  print('UPLOADED',dest,round(source.stat().st_size/1048576,2),'MiB',flush=True)
  receipt.write_text(json.dumps(results,indent=2))
print('ALL_UPLOADS_DONE',len(results),'PRIVATE_BLOB_FILES',flush=True)
