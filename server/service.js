import { all,get,run,tx,audit,notify,publicUser } from './db.js';
import { check,str,int,oneOf,date,today,addDays,overdue,policies,validateEligibility } from './domain.js';
export const kinds=['authors','publishers','genres','categories','languages','tags','author_roles'];
export const conditions=['Excellent','Normal','Bad'];
export function requireStaff(u) { check(['admin','librarian'].includes(u.role),'Недостаточно прав',403); }
export function requireAdmin(u) { check(u.role==='admin','Только для администратора',403); }
export function find(table,id) {
 const r=get(`SELECT * FROM ${table} WHERE id=?`,int(Number(id),'ID'));
 check(r,'Запись не найдена',404); return r;
}
export function ref(id,kind) { const r=find('refs',id); check(r.kind===kind,'Неверный тип справочника'); return r.id; }
export function bookDetails(b) {
 return {...b,publisher:b.publisher_id?get('SELECT name FROM refs WHERE id=?',b.publisher_id)?.name:'',
 refs:all('SELECT r.*,br.role FROM book_refs br JOIN refs r ON r.id=br.ref_id WHERE br.book_id=?',b.id).map(r=>({...r,extra:JSON.parse(r.extra)})),
 copies:all('SELECT * FROM copies WHERE book_id=? ORDER BY inventory',b.id),
 available:get("SELECT count(*) AS n FROM copies WHERE book_id=? AND status='Available' AND condition!='Bad'",b.id).n};
}
function links(b) {
 check(Array.isArray(b.refs??[]) && (b.refs??[]).length<=100,'Неверные связи');
 return (b.refs??[]).map(x=>{
  const r=find('refs',x.id); check(['authors','genres','categories','languages','tags'].includes(r.kind),'Недопустимый справочник');
  const role=r.kind==='authors'?str(x.role||'Author','Роль автора',45):'';
  if(r.kind==='authors') check(get("SELECT id FROM refs WHERE kind='author_roles' AND name=?",role),'Роль автора отсутствует');
  return {id:r.id,role};
 });
}
export function saveBook(u,b,id=null) {
 requireStaff(u);
 const title=str(b.title,'Название',200), annotation=str(b.annotation??'','Аннотация',5000,false);
 const pages=int(b.pages,'Страницы',1,100000), limit=int(b.age_limit,'Возраст',0,22);
 const publisher=ref(b.publisher_id,'publishers'), isbn=str(b.isbn??'','ISBN',32,false), refs=links(b);
 return tx(()=>{
  if(id) { find('books',id); run('UPDATE books SET title=?,annotation=?,pages=?,age_limit=?,publisher_id=?,isbn=? WHERE id=?',title,annotation,pages,limit,publisher,isbn,id); }
  else id=Number(run('INSERT INTO books(title,annotation,pages,age_limit,publisher_id,isbn) VALUES(?,?,?,?,?,?)',title,annotation,pages,limit,publisher,isbn).lastInsertRowid);
  run('DELETE FROM book_refs WHERE book_id=?',id);
  for(const r of refs) run('INSERT INTO book_refs(book_id,ref_id,role) VALUES(?,?,?)',id,r.id,r.role);
  audit(u.id,'save','book',id); return bookDetails(find('books',id));
 });
}
export function saveCopy(u,b,id=null) {
 requireStaff(u); const book=find('books',b.book_id);
 const inventory=str(b.inventory,'Инвентарный номер',60), location=str(b.location??'','Место хранения',100,false);
 const received=date(b.received_at), year=int(b.publication_year,'Год издания',1,Number(today().slice(0,4))+1);
 const condition=oneOf(b.condition,conditions,'Состояние'), notes=str(b.notes??'','Примечание',1000,false);
 check(received<=today(),'Дата поступления не может быть в будущем');
 return tx(()=>{
  if(id) {
   const old=find('copies',id); check(old.book_id===book.id,'Нельзя менять книгу существующего экземпляра');
   if(['Issued','Reserved','Debited'].includes(old.status)) check(condition===old.condition,'Состояние меняется при возврате или до списания');
   run('UPDATE copies SET inventory=?,location=?,received_at=?,publication_year=?,condition=?,notes=? WHERE id=?',inventory,location,received,year,condition,notes,id);
  } else id=Number(run('INSERT INTO copies(book_id,inventory,location,received_at,publication_year,condition,notes) VALUES(?,?,?,?,?,?,?)',book.id,inventory,location,received,year,condition,notes).lastInsertRowid);
  audit(u.id,'save','copy',id); return find('copies',id);
 });
}
export function counts(readerId) { return get('SELECT count(*) n FROM loans WHERE reader_id=? AND returned_at IS NULL',readerId).n; }
export function issue(u,b) {
 requireStaff(u);
 return tx(()=>{
  const reader=find('users',b.reader_id), copy=find('copies',b.copy_id), book=find('books',copy.book_id);
  validateEligibility(reader,book,counts(reader.id)); check(copy.condition!=='Bad','Повреждённый экземпляр нельзя выдать');
  const reservation=get("SELECT * FROM reservations WHERE copy_id=? AND status='active'",copy.id);
  check(copy.status==='Available' || (copy.status==='Reserved' && reservation?.reader_id===reader.id),'Экземпляр недоступен');
  const days=int(b.days??policies[reader.category].days,'Срок выдачи',1,90);
  const id=Number(run('INSERT INTO loans(copy_id,reader_id,issued_at,due_at) VALUES(?,?,?,?)',copy.id,reader.id,today(),addDays(today(),days)).lastInsertRowid);
  run("UPDATE copies SET status='Issued' WHERE id=?",copy.id);
  if(reservation) run("UPDATE reservations SET status='fulfilled' WHERE id=?",reservation.id);
  audit(u.id,'issue','loan',id); notify(reader.id,`Выдана книга «${book.title}». Вернуть до ${addDays(today(),days)}.`);
  return find('loans',id);
 });
}
export function returnLoan(u,id,b) {
 requireStaff(u); const condition=oneOf(b.condition,conditions,'Состояние при возврате');
 const notes=str(b.notes??'','Примечание',1000,false);
 return tx(()=>{
  const loan=find('loans',id); check(!loan.returned_at,'Книга уже возвращена',409);
  run('UPDATE loans SET returned_at=?,condition_on_return=?,notes=? WHERE id=?',today(),condition,notes,loan.id);
  run("UPDATE copies SET status='Available',condition=? WHERE id=?",condition,loan.copy_id);
  audit(u.id,'return','loan',loan.id); notify(loan.reader_id,'Возврат книги зарегистрирован. Спасибо!'); return find('loans',loan.id);
 });
}
export function reserve(u,b) {
 check(u.role==='reader','Бронировать может читатель',403);
 return tx(()=>{
  const book=find('books',b.book_id); validateEligibility(u,book,counts(u.id));
  check(get("SELECT count(*) n FROM reservations WHERE reader_id=? AND status='active'",u.id).n<3,'Лимит: три активных бронирования');
  check(!get("SELECT r.id FROM reservations r JOIN copies c ON c.id=r.copy_id WHERE r.reader_id=? AND r.status='active' AND c.book_id=?",u.id,book.id),'Эта книга уже забронирована');
  const copy=get("SELECT * FROM copies WHERE book_id=? AND status='Available' AND condition!='Bad' ORDER BY id LIMIT 1",book.id);
  check(copy,'Нет доступных экземпляров',409);
  const id=Number(run('INSERT INTO reservations(copy_id,reader_id,created_at,expires_at) VALUES(?,?,?,?)',copy.id,u.id,today(),addDays(today(),3)).lastInsertRowid);
  run("UPDATE copies SET status='Reserved' WHERE id=?",copy.id); audit(u.id,'reserve','reservation',id);
  notify(u.id,`Книга «${book.title}» забронирована до ${addDays(today(),3)} включительно. Обратитесь к библиотекарю.`);
  return find('reservations',id);
 });
}
export function cancelReservation(u,id) {
 return tx(()=>{ const r=find('reservations',id); check(u.role!=='reader'||r.reader_id===u.id,'Нет доступа',403);
  check(r.status==='active','Бронирование уже закрыто',409);
  run("UPDATE reservations SET status='cancelled' WHERE id=?",r.id); run("UPDATE copies SET status='Available' WHERE id=? AND status='Reserved'",r.copy_id);
  audit(u.id,'cancel','reservation',r.id); notify(r.reader_id,'Бронирование отменено'); return {ok:true};
 });
}
export function renew(u,id) {
 return tx(()=>{
  const loan=find('loans',id); check(u.role!=='reader'||loan.reader_id===u.id,'Нет доступа',403);
  check(!loan.returned_at && overdue(loan.due_at)===0 && loan.renewals<1,'Продление недоступно: просрочка, возврат или лимит продлений');
  const reader=find('users',loan.reader_id); check(reader.active,'Читатель заблокирован');
  const due=addDays(loan.due_at,policies[reader.category].days);
  run('UPDATE loans SET due_at=?,renewals=renewals+1 WHERE id=?',due,loan.id); audit(u.id,'renew','loan',loan.id); notify(reader.id,`Срок возврата продлён до ${due}`); return find('loans',loan.id);
 });
}
export function maintain() {
 tx(()=>{
  run('DELETE FROM sessions WHERE expires_at<?',Date.now());
  for(const r of all("SELECT * FROM reservations WHERE status='active' AND expires_at<?",today())) {
   run("UPDATE reservations SET status='expired' WHERE id=?",r.id); run("UPDATE copies SET status='Available' WHERE id=? AND status='Reserved'",r.copy_id);
   notify(r.reader_id,'Срок бронирования истёк'); audit(null,'expire','reservation',r.id);
  }
  for(const l of all('SELECT l.*,b.title FROM loans l JOIN copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id WHERE returned_at IS NULL AND due_at<=?',addDays(today(),2))) {
   notify(l.reader_id,`${l.due_at<today()?'Просрочен возврат':'Приближается возврат'}: «${l.title}», срок ${l.due_at}`,`due:${l.id}:${l.due_at}:${l.due_at<today()?'late':'soon'}`);
  }
 });
}
export function loanList(u) {
 const where=u.role==='reader'?'WHERE l.reader_id=?':'';
 return all(`SELECT l.*,b.title,c.inventory,u.surname||' '||u.name AS reader FROM loans l JOIN copies c ON c.id=l.copy_id JOIN books b ON b.id=c.book_id JOIN users u ON u.id=l.reader_id ${where} ORDER BY l.id DESC`,...(u.role==='reader'?[u.id]:[])).map(l=>({...l,overdue:overdue(l.due_at,l.returned_at||today())}));
}
export function saveDocument(u,b,id=null) {
 requireStaff(u); const title=str(b.title,'Название',200), annotation=str(b.annotation??'','Аннотация',5000,false), limit=int(b.age_limit??0,'Возраст',0,22);
 const language=b.language_id?ref(b.language_id,'languages'):null, refs=links(b);
 check(Array.isArray(b.book_ids??[]) && (b.book_ids??[]).length<=100,'Некорректные книги');
 const books=[...new Set(b.book_ids??[])].map(id=>find('books',id).id);
 return tx(()=>{
  if(id) {find('documents',id);run('UPDATE documents SET title=?,annotation=?,age_limit=?,language_id=? WHERE id=?',title,annotation,limit,language,id);}
  else id=Number(run('INSERT INTO documents(title,annotation,age_limit,language_id) VALUES(?,?,?,?)',title,annotation,limit,language).lastInsertRowid);
  run('DELETE FROM document_books WHERE document_id=?',id);run('DELETE FROM document_refs WHERE document_id=?',id);
  for(const book of books) run('INSERT INTO document_books VALUES(?,?)',id,book);
  for(const r of refs) run('INSERT INTO document_refs VALUES(?,?,?)',id,r.id,r.role);
  audit(u.id,'save','document',id); return find('documents',id);
 });
}
