import {DatabaseSync} from 'node:sqlite';
import {hashPassword} from './server/passwords.js';
import {existsSync} from 'node:fs';
const file=process.env.DB_PATH||'data/library.sqlite',tag='demo-classics-70-v1';
if(!existsSync(file))throw Error('Database not found: '+file);
const db=new DatabaseSync(file),get=(s,...p)=>db.prepare(s).get(...p),run=(s,...p)=>db.prepare(s).run(...p),id=(s,...p)=>Number(run(s,...p).lastInsertRowid);
const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10);
const catalog=[["Капитанская дочка", "Александр Пушкин", "Русский"], ["Дубровский", "Александр Пушкин", "Русский"], ["Пиковая дама", "Александр Пушкин", "Русский"], ["Борис Годунов", "Александр Пушкин", "Русский"], ["Повести Белкина", "Александр Пушкин", "Русский"], ["Мёртвые души", "Николай Гоголь", "Русский"], ["Ревизор", "Николай Гоголь", "Русский"], ["Шинель", "Николай Гоголь", "Русский"], ["Нос", "Николай Гоголь", "Русский"], ["Тарас Бульба", "Николай Гоголь", "Русский"], ["Анна Каренина", "Лев Толстой", "Русский"], ["Воскресение", "Лев Толстой", "Русский"], ["Хаджи-Мурат", "Лев Толстой", "Русский"], ["Детство", "Лев Толстой", "Русский"], ["Смерть Ивана Ильича", "Лев Толстой", "Русский"], ["Преступление и наказание", "Фёдор Достоевский", "Русский"], ["Идиот", "Фёдор Достоевский", "Русский"], ["Братья Карамазовы", "Фёдор Достоевский", "Русский"], ["Бедные люди", "Фёдор Достоевский", "Русский"], ["Белые ночи", "Фёдор Достоевский", "Русский"], ["Отцы и дети", "Иван Тургенев", "Русский"], ["Дворянское гнездо", "Иван Тургенев", "Русский"], ["Рудин", "Иван Тургенев", "Русский"], ["Ася", "Иван Тургенев", "Русский"], ["Записки охотника", "Иван Тургенев", "Русский"], ["Вишнёвый сад", "Антон Чехов", "Русский"], ["Чайка", "Антон Чехов", "Русский"], ["Три сестры", "Антон Чехов", "Русский"], ["Дядя Ваня", "Антон Чехов", "Русский"], ["Палата № 6", "Антон Чехов", "Русский"], ["Эмма", "Джейн Остин", "Английский"], ["Доводы рассудка", "Джейн Остин", "Английский"], ["Мэнсфилд-парк", "Джейн Остин", "Английский"], ["Нортенгерское аббатство", "Джейн Остин", "Английский"], ["Чувство и чувствительность", "Джейн Остин", "Английский"], ["Оливер Твист", "Чарльз Диккенс", "Английский"], ["Большие надежды", "Чарльз Диккенс", "Английский"], ["Холодный дом", "Чарльз Диккенс", "Английский"], ["Дэвид Копперфилд", "Чарльз Диккенс", "Английский"], ["Повесть о двух городах", "Чарльз Диккенс", "Английский"], ["Приключения Тома Сойера", "Марк Твен", "Английский"], ["Приключения Гекльберри Финна", "Марк Твен", "Английский"], ["Принц и нищий", "Марк Твен", "Английский"], ["Янки из Коннектикута при дворе короля Артура", "Марк Твен", "Английский"], ["Жизнь на Миссисипи", "Марк Твен", "Английский"], ["Гамлет", "Уильям Шекспир", "Английский"], ["Макбет", "Уильям Шекспир", "Английский"], ["Король Лир", "Уильям Шекспир", "Английский"], ["Отелло", "Уильям Шекспир", "Английский"], ["Сон в летнюю ночь", "Уильям Шекспир", "Английский"], ["Отверженные", "Виктор Гюго", "Французский"], ["Собор Парижской Богоматери", "Виктор Гюго", "Французский"], ["Человек, который смеётся", "Виктор Гюго", "Французский"], ["Девяносто третий год", "Виктор Гюго", "Французский"], ["Труженики моря", "Виктор Гюго", "Французский"], ["Три мушкетёра", "Александр Дюма", "Французский"], ["Граф Монте-Кристо", "Александр Дюма", "Французский"], ["Двадцать лет спустя", "Александр Дюма", "Французский"], ["Королева Марго", "Александр Дюма", "Французский"], ["Виконт де Бражелон", "Александр Дюма", "Французский"], ["Дети капитана Гранта", "Жюль Верн", "Французский"], ["Двадцать тысяч лье под водой", "Жюль Верн", "Французский"], ["Таинственный остров", "Жюль Верн", "Французский"], ["Вокруг света за восемьдесят дней", "Жюль Верн", "Французский"], ["Путешествие к центру Земли", "Жюль Верн", "Французский"], ["Сымон-музыка", "Якуб Колас", "Белорусский"], ["На ростанях", "Якуб Колас", "Белорусский"], ["Паўлінка", "Янка Купала", "Белорусский"], ["Тутэйшыя", "Янка Купала", "Белорусский"], ["Хрыстос прызямліўся ў Гародні", "Владимир Короткевич", "Белорусский"]];
const first='Анна Максим Ольга Павел Ирина Дмитрий Елена Артём Мария Денис Софья Никита Юлия Роман Светлана Андрей Наталья Кирилл Вера Сергей Дарья Пётр Кира Иван Алиса Илья Валерия Виктор Лидия Михаил'.split(' ');
const surnames='Коваленко Левченко Савченко Руденко Леско Ветрович Мироненко Соколенко Гринько Морозенко Шевченко Борисенко Климко Новицко Громыко Кравченко Петренко Василенко Лисенко Пинчук Ковальчук Бондарчук Левчук Гордейчук Романюк Яремчук Назарчук Ткачук Данилюк Костюк'.split(' ');
const plays=new Set(['Борис Годунов','Ревизор','Вишнёвый сад','Чайка','Три сестры','Дядя Ваня','Гамлет','Макбет','Король Лир','Отелло','Сон в летнюю ночь','Паўлінка','Тутэйшыя']);
const short=new Set(['Дубровский','Пиковая дама','Шинель','Нос','Тарас Бульба','Хаджи-Мурат','Детство','Смерть Ивана Ильича','Белые ночи','Ася','Палата № 6']);
const ref=(k,n)=>{run('INSERT INTO refs(kind,name) VALUES(?,?) ON CONFLICT(kind,name) DO NOTHING',k,n);return get('SELECT id FROM refs WHERE kind=? AND name=? COLLATE NOCASE',k,n).id;};
const audit=(a,v,e,x,d)=>run('INSERT INTO audit(actor_id,action,entity,entity_id,detail) VALUES(?,?,?,?,?)',a,v,e,x,d);
let begun=false;
try{
 db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 if(get('SELECT 1 FROM audit WHERE action=?',tag)){console.log('Already installed.');}else{
 const hashes=await Promise.all(first.map(()=>hashPassword(process.env.DEMO_PASSWORD)));
 db.exec('BEGIN IMMEDIATE');begun=true;
 if(get('SELECT 1 FROM audit WHERE action=?',tag))throw Error('Already installed by another process');
 const role=get("SELECT name FROM refs WHERE kind='author_roles' ORDER BY (name='Author') DESC,id LIMIT 1")?.name||'Author';ref('author_roles',role);
 const pub=['Классическая полка','Литературный архив','Открытая книга','Читательский круг','Беларускі том','Библиотека приключений'].map(n=>ref('publishers','Демо · '+n));
 const marker=ref('tags','Демо · Классика 70');
 const people=first.map((name,i)=>id('INSERT INTO users(email,password,name,surname,birth_date,phone,category,role,active) VALUES(?,?,?,?,?,?,?,?,?)',`classic.${String(i+1).padStart(2,'0')}@library.invalid`,hashes[i],name,surnames[i],day(-365*[14,21,35,68][i%4]-100),`+375290780${String(i+1).padStart(3,'0')}`,i>=26?'Adult':['Schoolboy','Student','Adult','Pensioner'][i%4],i>=26?'librarian':'reader',i===25?0:1));
 const actor=get("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY id LIMIT 1")?.id??null,copies=[];
 for(const [i,[title,author,language]] of catalog.entries()){
  if(get('SELECT id FROM books WHERE title=? COLLATE NOCASE',title))throw Error('Title already present: '+title+'; use a clean demo copy.');
  const drama=plays.has(title),adventure=['Марк Твен','Александр Дюма','Жюль Верн'].includes(author),genre=drama?'Пьеса':short.has(title)?'Малая проза':author==='Янка Купала'||title==='Сымон-музыка'?'Поэзия':adventure?'Приключения':'Роман и длинная проза';
  const age=adventure?6:12;
  const code='978000081'+String(i+1).padStart(3,'0'),isbn=code+(10-[...code].reduce((a,c,j)=>a+Number(c)*(j%2?3:1),0)%10)%10;
  const b=id('INSERT INTO books(title,annotation,pages,age_limit,publisher_id,isbn) VALUES(?,?,?,?,?,?)',title,'Учебная карточка. ISBN, год, объём и издательство условны.',100+i*7,age,pub[i%6],isbn),a=ref('authors',author),g=ref('genres',genre),l=ref('languages',language),c=ref('categories',drama?'Драматургия':adventure?'Приключенческая литература':'Художественная литература');
  for(const [r,v] of [[a,role],[g,''],[l,''],[c,''],[marker,''],[ref('tags','Демо · '+(drama?'Театр':adventure?'Приключения':language==='Русский'?'Русская классика':'Мировая классика')),'']])run('INSERT INTO book_refs VALUES(?,?,?)',b,r,v);
  const group=[];for(let j=0;j<2+i%3;j++)group.push(id('INSERT INTO copies(book_id,inventory,status,location,received_at,publication_year,condition) VALUES(?,?,?,?,?,?,?)',b,`CLASSIC-${i+1}-${j+1}`,j===2&&i%5===0?'Debited':'Available',`Зал ${1+i%4}, полка ${1+j}`,day(-180),2000+i%25,j===2&&i%5===1?'Bad':j===1?'Excellent':'Normal'));
  copies.push(group);
  if(i%6===0){const d=id('INSERT INTO documents(title,annotation,age_limit,language_id) VALUES(?,?,?,?)',`Учебный фрагмент: ${title}`,'Тестовая связь произведения с изданием.',age,l);run('INSERT INTO document_books VALUES(?,?)',d,b);for(const [r,v] of [[a,role],[g,''],[c,'']])run('INSERT INTO document_refs VALUES(?,?,?)',d,r,v);}
 }
 const status=(c,s)=>run('UPDATE copies SET status=? WHERE id=?',s,c);
 const note=(u,message,key,read)=>run('INSERT INTO notifications(user_id,message,read_at,dedupe) VALUES(?,?,?,?)',u,message,read?day(0):null,tag+key);
 for(let i=0;i<40;i++){
  const c=copies[i][0],u=people[i===0?26:i%25],open=i<16,due=open?(i%4===0?-3:i%4===1?1:12):-10,back=open?null:day(due+(i%3===0?3:-2));
  const x=id('INSERT INTO loans(copy_id,reader_id,issued_at,due_at,returned_at,condition_on_return,notes,renewals) VALUES(?,?,?,?,?,?,?,?)',c,u,day(due-14),day(due),back,open?null:'Normal','Учебная выдача',open&&i%5===2?1:0);
  if(open)status(c,'Issued');audit(actor,'issue','loan',x,catalog[i][0]);if(!open)audit(actor,'return','loan',x,catalog[i][0]);note(u,(open?'Выдана книга: ':'Книга возвращена: ')+catalog[i][0],'loan'+i,!open);
 }
 for(let i=0;i<12;i++){
  const fulfilled=i>=10,bi=fulfilled?16+i-10:40+i,c=copies[bi][0],u=people[fulfilled?bi:i],state=i<6?'active':i<8?'expired':i<10?'cancelled':'fulfilled';
  const x=id('INSERT INTO reservations(copy_id,reader_id,created_at,expires_at,status) VALUES(?,?,?,?,?)',c,u,day(fulfilled?-26:i<6?-1:-8),day(fulfilled?-23:i<6?2:-5),state);if(state==='active')status(c,'Reserved');audit(actor,'reserve','reservation',x,state);note(u,'Бронирование: '+catalog[bi][0],'reserve'+i,state!=='active');
 }
 audit(null,tag,'seed',null,'Учебный набор');
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Foreign key check failed');
 db.exec('COMMIT');begun=false;console.log('Installed: 70 books, 209 copies, 30 accounts, 40 loans, 12 reservations, 12 documents.');
 }
}catch(e){if(begun)db.exec('ROLLBACK');console.error(e.message);process.exitCode=1;}finally{db.close();}
