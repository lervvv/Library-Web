import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { api } from './api.js';
import { session, rateLimit } from './security.js';
import { get } from './db.js';
import { maintain } from './service.js';
import { AppError,check } from './domain.js';
const port=Number(process.env.PORT||3000),host=process.env.HOST||'127.0.0.1';
const assets={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/styles.css':['styles.css','text/css']};
async function readBody(req) {
 req.setEncoding('utf8');
 let data='';for await(const chunk of req) {data+=chunk;check(Buffer.byteLength(data)<=100000,'Слишком большой запрос',413);}
 if(!data) return {};
 check(req.headers['content-type']?.startsWith('application/json'),'Ожидается JSON',415);
 try {const value=JSON.parse(data);check(value && typeof value==='object'&&!Array.isArray(value),'Неверный JSON');return value;}
 catch(e) {if(e instanceof AppError)throw e;throw new AppError(400,'Некорректный JSON');}
}
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
 res.setHeader('Cache-Control','no-store');
 try {
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/')) {
   rateLimit(`api:${req.socket.remoteAddress}`,3000);
   if(!['GET','HEAD'].includes(req.method)) {
    check(!req.headers['sec-fetch-site']||req.headers['sec-fetch-site']!=='cross-site','Запрос с другого сайта запрещён',403);
    if(req.headers.origin) check(new URL(req.headers.origin).host===req.headers.host,'Недопустимый источник запроса',403);
   }
   const s=session(req);
   if(url.pathname==='/api/events'&&req.method==='GET') {
    check(s,'Необходимо войти',401);
    res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write('retry: 5000\n\n');let last=-1;
    const tick=()=>{
     if(!session(req)) {clearInterval(timer);res.end();return;}
     const id=get('SELECT coalesce(max(id),0) id FROM notifications WHERE user_id=?',s.user_id).id;
     if(id!==last) {res.write(`event: notifications\ndata: ${JSON.stringify({latest:id})}\n\n`);last=id;}
     else res.write(': heartbeat\n\n');
    };
    const timer=setInterval(tick,5000);tick();res.on('close',()=>clearInterval(timer));return;
   }
   return await api(req,res,url,await readBody(req),s);
  }
  const asset=assets[url.pathname];check(asset&&req.method==='GET','Страница не найдена',404);
  const data=await readFile(new URL(`../public/${asset[0]}`,import.meta.url));res.writeHead(200,{'Content-Type':`${asset[1]}; charset=utf-8`});res.end(data);
 } catch(e) {
  if(res.headersSent){res.end();return;}
  const conflict=String(e.message).includes('constraint failed')||String(e.message).includes('UNIQUE constraint');
  const status=e.status||(conflict?409:500);
  if(status===500)console.error(e);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});
  res.end(JSON.stringify({error:status===500?'Внутренняя ошибка сервера':conflict?'Конфликт данных: запись уже существует или используется в связанных данных':e.message}));
 }
});
maintain();const job=setInterval(()=>{try{maintain();}catch(e){console.error('Maintenance failed',e);}},60000);job.unref();
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(port,host,()=>console.log(`Library: http://${host}:${server.address().port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(job);server.close(()=>process.exit());});
