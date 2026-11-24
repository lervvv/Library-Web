import { all,get,run,tx,audit,publicUser } from './db.js';
import { hashPassword,verifyPassword,createSession,cookie,rateLimit } from './security.js';
import { AppError,check,str,int,oneOf,validateReader,policies } from './domain.js';
import * as service from './service.js';
function validatePersonExtra(kind,extra){
 if(kind!=='authors')return;
 check(extra&&typeof extra==='object'&&!Array.isArray(extra),'Неверные данные автора');
 const today=new Date().toISOString().slice(0,10);
 for(const key of ['birth_date','death_date']){
  const value=extra[key];if(value===undefined||value===null||value==='')continue;
  check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value.slice(0,4)!=='0000','Введите дату в формате ГГГГ-ММ-ДД');
  const d=new Date(value+'T00:00:00Z');check(Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value,'Указана несуществующая дата');
  check(value<=today,'Дата рождения или смерти не может быть в будущем');
 }
 check(!extra.birth_date||!extra.death_date||extra.death_date>=extra.birth_date,'Дата смерти не может быть раньше даты рождения');
}

export async function api(req,res,url,body,s) {
 const path=url.pathname, method=req.method, u=s?.user;
 const send=(value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 if(path==='/api/auth/csrf' && method==='GET') return send({csrf:s?.csrf??null,user:publicUser(u)});
 if(['/api/auth/login','/api/auth/register'].includes(path) && method==='POST') {
  rateLimit(`auth:${req.socket.remoteAddress}`);
  if(path.endsWith('register')) {
   const r=validateReader(body), password=await hashPassword(body.password);
   const id=tx(()=>{const id=Number(run('INSERT INTO users(email,password,name,surname,patronymic,birth_date,phone,address) VALUES(?,?,?,?,?,?,?,?)',r.email,password,r.name,r.surname,r.patronymic,r.birth_date,r.phone,r.address).lastInsertRowid);audit(id,'register','user',id);return id;});
   return send({user:publicUser(service.find('users',id)),csrf:createSession(id,res)},201);
  }
  const email=str(body.email,'Email',150).toLowerCase(); const user=get('SELECT * FROM users WHERE email=?',email);
  // A real scrypt calculation also runs for unknown accounts.
  const dummy='00000000000000000000000000000000:'+ '00'.repeat(64);
  const valid=await verifyPassword(body.password,user?.password||dummy);
  check(valid && user?.active,'Неверный email, пароль или учётная запись заблокирована',401);
  audit(user.id,'login','user',user.id);return send({user:publicUser(user),csrf:createSession(user.id,res)});
 }
 check(u,'Необходимо войти',401);
 if(!['GET','HEAD'].includes(method)) check(req.headers['x-csrf-token']===s.csrf,'Сессия формы устарела. Обновите страницу',403);
 if(path==='/api/auth/logout' && method==='POST') {run('DELETE FROM sessions WHERE token_hash=?',s.token_hash);res.setHeader('Set-Cookie',cookie('',0));return send({ok:true});}
 if(path==='/api/profile' && method==='GET') return send({user:publicUser(u),policies});
 if(path==='/api/profile' && method==='PUT') {
  const r=validateReader({...u,...body});
  tx(()=>{run('UPDATE users SET name=?,surname=?,patronymic=?,phone=?,address=? WHERE id=?',r.name,r.surname,r.patronymic,r.phone,r.address,u.id);audit(u.id,'profile','user',u.id);});
  return send(publicUser(service.find('users',u.id)));
 }
 if(path==='/api/profile/password' && method==='POST') {
  rateLimit(`password:${u.id}`);check(await verifyPassword(body.current,u.password),'Текущий пароль неверен');const hash=await hashPassword(body.password);
  tx(()=>{run('UPDATE users SET password=? WHERE id=?',hash,u.id);run('DELETE FROM sessions WHERE user_id=? AND token_hash!=?',u.id,s.token_hash);audit(u.id,'password','user',u.id);});return send({ok:true});
 }
 if(path==='/api/refs' && method==='GET') return send(all('SELECT * FROM refs ORDER BY name').map(r=>({...r,extra:JSON.parse(r.extra)})));
 if(path==='/api/refs' && method==='POST') {
  service.requireStaff(u);const kind=oneOf(body.kind,service.kinds,'Справочник'),name=str(body.name,'Название',150);
  check(body.extra===undefined || (body.extra && typeof body.extra==='object' && !Array.isArray(body.extra)),'Неверные дополнительные поля');
  validatePersonExtra(kind,body.extra??{});
  const extra=JSON.stringify(body.extra??{});check(extra.length<=2000,'Слишком большие дополнительные поля');
  return send(tx(()=>{const id=Number(run('INSERT INTO refs(kind,name,extra) VALUES(?,?,?)',kind,name,extra).lastInsertRowid);audit(u.id,'create','ref',id);return service.find('refs',id);}),201);
 }
 let m=path.match(/^\/api\/refs\/(\d+)$/);
 if(m && ['PUT','DELETE'].includes(method)) {
  service.requireStaff(u); const old=service.find('refs',m[1]);
  check(old.kind!=='author_roles','Системные роли авторов нельзя менять или удалять');
  return send(tx(()=>{
   if(method==='DELETE') run('DELETE FROM refs WHERE id=?',old.id);
   else {validatePersonExtra(old.kind,body.extra??{});const name=str(body.name,'Название',150);const extra=JSON.stringify(body.extra??{});check(extra.length<=2000,'Слишком большие поля');run('UPDATE refs SET name=?,extra=? WHERE id=?',name,extra,old.id);}
   audit(u.id,method.toLowerCase(),'ref',old.id);return {ok:true};
  }));
 }
 if(path==='/api/books' && method==='GET') {
  const q=(url.searchParams.get('q')||'').toLocaleLowerCase('ru');
  let rows=all('SELECT * FROM books').map(service.bookDetails);
  const author=(url.searchParams.get('author')||'').toLocaleLowerCase('ru');
  rows=rows.filter(b=> (!q || [b.title,b.isbn].some(v=>String(v??'').toLocaleLowerCase('ru').includes(q))) && (!author || b.refs.some(r=>r.kind==='authors'&&r.name.toLocaleLowerCase('ru').includes(author))) && (!url.searchParams.get('publisher') || b.publisher_id===Number(url.searchParams.get('publisher'))) && [['genre','genres'],['tag','tags'],['category','categories'],['language','languages']].every(([key,kind])=>!url.searchParams.get(key)||b.refs.some(r=>r.kind===kind&&r.id===Number(url.searchParams.get(key)))) && (url.searchParams.get('available')!=='true'||b.available>0));
  const sort=oneOf(url.searchParams.get('sort')||'title',['title','available','id'],'Сортировка');
  rows.sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'ru'):b[sort]-a[sort]);
  const page=Math.max(1,Number(url.searchParams.get('page'))||1), size=24;
  return send({items:rows.slice((page-1)*size,page*size),total:rows.length,page,pages:Math.ceil(rows.length/size)});
 }
 if(path==='/api/books'&&method==='POST') return send(service.saveBook(u,body),201);
 m=path.match(/^\/api\/books\/(\d+)$/);
 if(m) {
  const b=service.find('books',m[1]);
  if(method==='GET') return send(service.bookDetails(b));
  if(method==='PUT') return send(service.saveBook(u,body,b.id));
  if(method==='DELETE') {service.requireStaff(u);return send(tx(()=>{run('DELETE FROM books WHERE id=?',b.id);audit(u.id,'delete','book',b.id);return {ok:true};}));}
 }
 if(path==='/api/copies'&&method==='GET') {service.requireStaff(u);return send(all('SELECT c.*,b.title FROM copies c JOIN books b ON b.id=c.book_id ORDER BY c.id DESC'));}
 if(path==='/api/copies'&&method==='POST') return send(service.saveCopy(u,body),201);
 m=path.match(/^\/api\/copies\/(\d+)$/);
 if(m&&method==='PUT') return send(service.saveCopy(u,body,Number(m[1])));
 if(m&&method==='DELETE') {
  service.requireStaff(u);return send(tx(()=>{const c=service.find('copies',m[1]);check(c.status==='Available','Можно списать только свободный экземпляр');run("UPDATE copies SET status='Debited' WHERE id=?",c.id);audit(u.id,'debit','copy',c.id);return {ok:true};}));
 }
 if(path==='/api/users'&&method==='GET') {service.requireStaff(u);return send(all('SELECT * FROM users ORDER BY surname,name').map(publicUser));}
 if(path==='/api/users'&&method==='POST') {
  service.requireStaff(u);const r=validateReader(body);const role=oneOf(body.role||'reader',['reader','librarian','admin'],'Роль');if(role!=='reader')service.requireAdmin(u);
  const category=oneOf(body.category||'Adult',Object.keys(policies),'Категория'),password=body.password?await hashPassword(body.password):null;
  check(role==='reader'||password,'Для сотрудника нужен пароль');
  return send(tx(()=>{const id=Number(run('INSERT INTO users(email,password,name,surname,patronymic,birth_date,phone,address,category,role) VALUES(?,?,?,?,?,?,?,?,?,?)',r.email,password,r.name,r.surname,r.patronymic,r.birth_date,r.phone,r.address,category,role).lastInsertRowid);audit(u.id,'create','user',id);return publicUser(service.find('users',id));}),201);
 }
 m=path.match(/^\/api\/users\/(\d+)$/);
 if(m&&method==='PUT') {
  service.requireStaff(u);const old=service.find('users',m[1]);
  if(old.role!=='reader') service.requireAdmin(u);
  const r=validateReader(body),role=oneOf(body.role??old.role,['reader','librarian','admin'],'Роль');
  if(role!==old.role) service.requireAdmin(u);
  const active=int(body.active,'Активность',0,1),category=oneOf(body.category,Object.keys(policies),'Категория');
  check(!(old.id===u.id&&(role!==old.role||!active)),'Нельзя понизить или заблокировать самого себя');
  const password=body.password?await hashPassword(body.password):old.password;
  check(role==='reader'||password,'У сотрудника должен быть пароль');
  return send(tx(()=>{
   if(old.role==='admin'&&(!active||role!=='admin')) check(get("SELECT count(*) n FROM users WHERE role='admin' AND active=1 AND id!=?",old.id).n>0,'Нельзя удалить последнего администратора');
   check(old.role===role||(!service.counts(old.id)&&!get("SELECT id FROM reservations WHERE reader_id=? AND status='active'",old.id)),'Сначала закройте выдачи и бронирования');
   run('UPDATE users SET email=?,password=?,name=?,surname=?,patronymic=?,birth_date=?,phone=?,address=?,category=?,role=?,active=? WHERE id=?',r.email,password,r.name,r.surname,r.patronymic,r.birth_date,r.phone,r.address,category,role,active,old.id);
   run('DELETE FROM sessions WHERE user_id=?',old.id);audit(u.id,'update','user',old.id);return publicUser(service.find('users',old.id));
  }));
 }
 if(path==='/api/loans'&&method==='GET') return send(service.loanList(u));
 if(path==='/api/loans'&&method==='POST') return send(service.issue(u,body),201);
 m=path.match(/^\/api\/loans\/(\d+)\/(return|renew)$/);
 if(m&&method==='POST') return send(m[2]==='return'?service.returnLoan(u,Number(m[1]),body):service.renew(u,Number(m[1])));
 if(path==='/api/reservations'&&method==='GET') return send(all(`SELECT r.*,b.title,c.inventory,u.surname||' '||u.name AS reader FROM reservations r JOIN copies c ON c.id=r.copy_id JOIN books b ON b.id=c.book_id JOIN users u ON u.id=r.reader_id ${u.role==='reader'?'WHERE r.reader_id=?':''} ORDER BY r.id DESC`,...(u.role==='reader'?[u.id]:[])));
 if(path==='/api/reservations'&&method==='POST') return send(service.reserve(u,body),201);
 m=path.match(/^\/api\/reservations\/(\d+)$/);
 if(m&&method==='DELETE') return send(service.cancelReservation(u,Number(m[1])));
 if(path==='/api/documents'&&method==='GET') return send(all('SELECT * FROM documents ORDER BY title').map(d=>({...d,book_ids:all('SELECT book_id FROM document_books WHERE document_id=?',d.id).map(x=>x.book_id),refs:all('SELECT r.*,dr.role FROM document_refs dr JOIN refs r ON r.id=dr.ref_id WHERE document_id=?',d.id)})));
 if(path==='/api/documents'&&method==='POST') return send(service.saveDocument(u,body),201);
 m=path.match(/^\/api\/documents\/(\d+)$/);
 if(m&&method==='PUT') return send(service.saveDocument(u,body,Number(m[1])));
 if(m&&method==='DELETE') {service.requireStaff(u);return send(tx(()=>{const d=service.find('documents',m[1]);run('DELETE FROM documents WHERE id=?',d.id);audit(u.id,'delete','document',d.id);return {ok:true};}));}
 if(path==='/api/notifications'&&method==='GET') return send(all('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100',u.id));
 if(path==='/api/notifications/read'&&method==='POST') {run('UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL',u.id);return send({ok:true});}
 if(path==='/api/audit'&&method==='GET') {service.requireAdmin(u);return send(all("SELECT a.*,coalesce(u.email,'system') AS actor FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 1000"));}
 if(path==='/api/stats'&&method==='GET') {
  service.requireStaff(u);return send({books:get('SELECT count(*) n FROM books').n,readers:get("SELECT count(*) n FROM users WHERE role='reader'").n,copies:all('SELECT status,count(*) n FROM copies GROUP BY status'),loans:get('SELECT count(*) n FROM loans WHERE returned_at IS NULL').n,overdue:get("SELECT count(*) n FROM loans WHERE returned_at IS NULL AND due_at<date('now')").n,popular:all('SELECT b.title,count(l.id) n FROM books b LEFT JOIN copies c ON c.book_id=b.id LEFT JOIN loans l ON l.copy_id=c.id GROUP BY b.id ORDER BY n DESC LIMIT 10')});
 }
 if(path==='/api/integrations/books'&&method==='GET') {
  service.requireStaff(u);rateLimit(`external:${u.id}`,60);const q=str(url.searchParams.get('q'),'Поиск',150);
  let response;
  try { response=await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=8&fields=key,title,author_name,isbn,number_of_pages_median,publisher`,{signal:AbortSignal.timeout(8000),headers:{'User-Agent':'LibraryCourseProject/1.0'}}); }
  catch {throw new AppError(502,'Внешний каталог недоступен. Используйте ручной ввод');}
  check(response.ok,'Ошибка внешнего каталога',502); const data=await response.json();
  return send((data.docs||[]).map(x=>({title:x.title,authors:x.author_name||[],isbn:x.isbn?.[0]||'',pages:x.number_of_pages_median||100,publisher:x.publisher?.[0]||'',source:`https://openlibrary.org${x.key}`})));
 }
 throw new AppError(404,'Маршрут не найден');
}
