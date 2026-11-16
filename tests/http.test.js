import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {once} from 'node:events';
const supported=Number(process.versions.node.split('.')[0])>=22;
test('HTTP: регистрация, cookie-сессия, CSRF и запрет административных маршрутов',{skip:!supported},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'library-http-'));
 const child=spawn(process.execPath,['server/index.js'],{env:{...process.env,PORT:'0',DB_PATH:join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});
 let output='',errors='';child.stderr.on('data',c=>errors+=c);
 try {
  const base=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Server start timeout: '+errors)),10000);
   child.stdout.on('data',c=>{output+=c;const match=output.match(/Library: (http:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}});
   child.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited: '+code+' '+errors));});
  });
  const call=(path,method='GET',body,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
  let r=await call('/api/books');assert.equal(r.status,401);
  r=await call('/api/auth/register','POST',{email:'test@example.com',password:'Example-pass-123',name:'Иван',surname:'Иванов',birth_date:'2000-01-01',phone:'+375291234567',role:'admin'});
  assert.equal(r.status,201);const cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();assert.equal(data.user.role,'reader');assert.ok(!('password'in data.user));
  r=await call('/api/books','GET',null,{Cookie:cookie});assert.equal(r.status,200);assert.ok((await r.json()).items.length>0);
  r=await call('/api/users','GET',null,{Cookie:cookie});assert.equal(r.status,403);
  r=await call('/api/audit','GET',null,{Cookie:cookie});assert.equal(r.status,403);
  r=await call('/api/notifications/read','POST',{}, {Cookie:cookie});assert.equal(r.status,403);
  const headers={Cookie:cookie,'X-CSRF-Token':data.csrf};
  r=await call('/api/notifications/read','POST',{},headers);assert.equal(r.status,200);
  r=await call('/api/books','POST',{},headers);assert.equal(r.status,403);
  r=await call('/api/auth/logout','POST',{},headers);assert.equal(r.status,200);
  r=await call('/api/books','GET',null,{Cookie:cookie});assert.equal(r.status,401);
 } finally {const exited=once(child,'exit');child.kill();await exited.catch(()=>{});await rm(dir,{recursive:true,force:true});}
});
