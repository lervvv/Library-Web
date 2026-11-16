import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
const file = process.env.DB_PATH || resolve('data/library.sqlite');
if (file !== ':memory:') mkdirSync(dirname(file), { recursive:true });
export const db = new DatabaseSync(file);
db.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
db.exec('PRAGMA busy_timeout=5000');
export const all = (sql,...args) => db.prepare(sql).all(...args);
export const get = (sql,...args) => db.prepare(sql).get(...args);
export const run = (sql,...args) => db.prepare(sql).run(...args);
export function tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const result=fn(); db.exec('COMMIT'); return result; } catch(e) { db.exec('ROLLBACK'); throw e; } }
export const audit = (actor,action,entity,id=null,detail='') => run('INSERT INTO audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',actor ?? null,action,entity,id,detail);
export const notify = (user,message,dedupe=null) => run('INSERT OR IGNORE INTO notifications(user_id,message,dedupe) VALUES(?,?,?)',user,message,dedupe);
export const publicUser = u => { if(!u) return null; const {password,...rest}=u; return rest; };
const seeds={authors:['Александр Пушкин','Якуб Колас','Джейн Остин'],publishers:['Учебное издательство'],genres:['Классика','Научная литература','Роман'],categories:['Художественная литература','Образование'],languages:['Русский','Белорусский','Английский'],tags:['Рекомендуем','Новинка'],author_roles:['Author','Co-author','Editor','Translator','Compiler','Illustrator']};
tx(()=>{ if(!get('SELECT id FROM refs LIMIT 1')) {
 for(const [kind,names] of Object.entries(seeds)) for(const name of names) run('INSERT INTO refs(kind,name) VALUES(?,?)',kind,name);
 const publisher=get("SELECT id FROM refs WHERE kind='publishers'").id;
 for(const [title,author] of [['Евгений Онегин','Александр Пушкин'],['Новая зямля','Якуб Колас'],['Гордость и предубеждение','Джейн Остин']]) {
  const id=Number(run('INSERT INTO books(title,pages,age_limit,publisher_id) VALUES(?,?,?,?)',title,240,12,publisher).lastInsertRowid);
  run('INSERT INTO book_refs(book_id,ref_id,role) VALUES(?,?,?)',id,get("SELECT id FROM refs WHERE kind='authors' AND name=?",author).id,'Author');
  run('INSERT INTO copies(book_id,inventory,received_at,publication_year) VALUES(?,?,?,?)',id,`DEMO-${id}`,'2026-01-01',2020);
 }
}});
