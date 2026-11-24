const fs=require('node:fs'),crypto=require('node:crypto'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const hashes={'public/app.js':'22ce66f8cbae963cee35e79c7f6a02dacbaba7bb','public/styles.css':'2d1b7edaf5d920523cda7905cf7e2190b2956e8d','server/api.js':'06510601ad98208656b6efd03ab0e90054f44f8b'};
const originals={},out={},written=[];
function once(s,a,b){if(s.split(a).length!==2)throw Error('Unexpected source: '+a.slice(0,80));return s.replace(a,()=>b);}
function fn(s,n,b){const m=new RegExp('^(?:async )?function '+n+'\\(','m').exec(s);if(!m)throw Error(n);const tail=m.index+m[0].length;const end=/^(?:async )?function /m.exec(s.slice(tail));if(!end)throw Error(n);return s.slice(0,m.index)+b+'\n'+s.slice(tail+end.index);}
try{
 for(const [f,h] of Object.entries(hashes)){const raw=originals[f]=fs.readFileSync(f);const b=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n'));if(crypto.createHash('sha1').update('blob '+b.length+'\0').update(b).digest('hex')!==h)throw Error('Different version: '+f);out[f]=b.toString();}
 let app=out['public/app.js'];
 app=fn(app,'usersView',`function sectionTabs(root,entries,current,change){const bar=document.createElement('div');bar.className='section-tabs';bar.setAttribute('role','group');bar.setAttribute('aria-label','Разделы');for(const [key,title] of entries){const button=action(title,()=>change(key));button.setAttribute('aria-pressed',String(key===current));bar.append(button);}root.append(bar);}
async function usersView(root){
 const all=await api('/users'),isStaff=filter.userSection==='staff',admin=user.role==='admin';
 heading(root,'Читатели и сотрудники',...(!isStaff||admin?[action(isStaff?'Добавить сотрудника':'Добавить читателя',()=>editUser({},isStaff))]:[]));
 sectionTabs(root,[['readers','Читатели'],['staff','Сотрудники']],isStaff?'staff':'readers',key=>{filter.userSection=key;return render();});
 const cols=[['id','№'],['surname','ФИО',r=>[r.surname,r.name,r.patronymic].filter(Boolean).join(' ')],['email','Email'],['phone','Телефон'],isStaff?['role','Должность',r=>label(r.role)]:['category','Категория',r=>label(r.category)],['active','Статус',r=>r.active?'Активен':'Заблокирован']];
 table(root,cols,all.filter(r=>isStaff?r.role!=='reader':r.role==='reader'),r=>[action('Карточка',()=>userDetail(r)),...(!isStaff||admin?[action('Изменить',()=>editUser(r,isStaff))]:[])]);
}`);
 app=fn(app,'editUser',`function editUser(r={},isStaff=false){
 const fields=readerFields(true).filter(f=>isStaff?f.name!=='category':f.name!=='role');
 if(isStaff){const role=fields.find(f=>f.name==='role');role.options=enumOptions(['librarian','admin']);const pass=fields.find(f=>f.name==='password');pass.required=!r.id;pass.title=r.id?'Новый пароль (пусто — не менять)':'Пароль сотрудника';}
 return formDialog(isStaff?'Учётная запись сотрудника':'Учётная запись читателя',fields,{role:isStaff?'librarian':'reader',...r,active:String(r.active??1)},async b=>{b.active=Number(b.active);if(!isStaff)b.role='reader';await api('/users'+(r.id?'/'+r.id:''),r.id?'PUT':'POST',b);});
}`);
 app=fn(app,'refsView',`async function refsView(root){
 refs=await api('/refs');const kinds=['authors','publishers','genres','categories','languages','tags','author_roles'],kind=kinds.includes(filter.refKind)?filter.refKind:'authors',system=kind==='author_roles',admin=user.role==='admin';
 heading(root,'Справочники',...(system?[]:[action('Добавить запись',()=>editRef({kind},kind))]));
 sectionTabs(root,kinds.map(k=>[k,label(k)]),kind,key=>{filter.refKind=key;return render();});
 const info=document.createElement('p');info.className='muted';info.textContent=system?'Системные роли доступны только для просмотра.':admin?'Удалять можно только записи, которые не используются.':'Вы можете добавлять и редактировать записи. Удаление доступно администратору.';root.append(info);
 const roleTitle={Author:'Автор','Co-author':'Соавтор',Editor:'Редактор',Translator:'Переводчик',Compiler:'Составитель',Illustrator:'Иллюстратор'};
 const cols=system?[['name','Роль',r=>roleTitle[r.name]||r.name]]:[['name',kind==='authors'?'ФИО':'Название'],...(kind==='authors'?[['birth_date','Дата рождения',r=>r.extra?.birth_date||'—'],['death_date','Дата смерти',r=>r.extra?.death_date||'—']]:[])];
 table(root,cols,refs.filter(r=>r.kind===kind),system?null:r=>[action('Изменить',()=>editRef(r,kind)),...(admin?[action('Удалить',()=>confirmAction('Удалить запись? Используемые записи удалить нельзя.',()=>api('/refs/'+r.id,'DELETE')),'danger')]:[])]);
}`);
 app=once(app,'function editRef(r={}){','function editRef(r={},fixedKind=null){');
 app=once(app,"...(!r.id?[field('kind'","...(!r.id&&!fixedKind?[field('kind'");
 app=once(app,"delete b.birth_date;delete b.death_date;await api('/refs'","delete b.birth_date;delete b.death_date;if(!r.id&&fixedKind)b.kind=fixedKind;await api('/refs'");
 app=fn(app,'statsView',`async function statsView(root){const s=await api('/stats');heading(root,'Обзор библиотеки');const metrics=[['Разных книг в каталоге',s.books],['Читателей',s.readers],['Текущие выдачи',s.loans],['Просрочено',s.overdue],...s.copies.filter(c=>c.status!=='Available').map(c=>[label(c.status)+' (экз.)',c.n]),['Доступно экземпляров',s.available_copies]];const grid=document.createElement('div');grid.className='stats';for(const [name,count] of metrics){const card=document.createElement('div');card.className='stat';const strong=document.createElement('strong');strong.textContent=count;card.append(strong,document.createTextNode(name));grid.append(card);}root.append(grid);const h=document.createElement('h2');h.textContent='Популярные книги';root.append(h);table(root,[['title','Название'],['n','Количество выдач']],s.popular);}`);
 app=once(app,'<p>${esc(u.email)} · ${esc(u.phone)}</p>','<p>${esc(u.email)}</p><p>Телефон: ${esc(u.phone)}</p>');
 app=once(app,' · Категория: ${esc(label(u.category))}','${u.role===\'reader\'?` · Категория: ${esc(label(u.category))}`:\'\'}');
 out['public/app.js']=app;
 out['public/styles.css']+='\n.section-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 20px}.section-tabs button[aria-pressed=true]{background:var(--accent);color:white;border-color:var(--accent)}\n';
 let api=out['server/api.js'];
 api=once(api,"name=str(body.name,'Название',150);\n  check(body.extra", "name=str(body.name,'Название',150);\n  check(kind!=='author_roles','Системные роли авторов нельзя добавлять',403);\n  check(body.extra");
 api=once(api,"if(method==='DELETE') run('DELETE FROM refs WHERE id=?',old.id);","if(method==='DELETE') {service.requireAdmin(u);run('DELETE FROM refs WHERE id=?',old.id);}");
 api=once(api,"const category=oneOf(body.category||'Adult',Object.keys(policies),'Категория'),password=", "const category=role==='reader'?oneOf(body.category||'Adult',Object.keys(policies),'Категория'):'Adult',active=int(body.active??1,'Активность',0,1),password=");
 api=once(api,"phone,address,category,role) VALUES(?,?,?,?,?,?,?,?,?,?)',r.email,password,r.name,r.surname,r.patronymic,r.birth_date,r.phone,r.address,category,role)","phone,address,category,role,active) VALUES(?,?,?,?,?,?,?,?,?,?,?)',r.email,password,r.name,r.surname,r.patronymic,r.birth_date,r.phone,r.address,category,role,active)");
 api=once(api,"category=oneOf(body.category,Object.keys(policies),'Категория');","category=role==='reader'?oneOf(body.category??old.category,Object.keys(policies),'Категория'):'Adult';");
 api=once(api,"copies:all('SELECT status,count(*) n FROM copies GROUP BY status'),","copies:all('SELECT status,count(*) n FROM copies GROUP BY status'),available_copies:get(\"SELECT count(*) n FROM copies WHERE status='Available' AND condition!='Bad'\").n,");
 out['server/api.js']=api;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'library-update-'));
 try{for(const [i,[f,s]] of Object.entries(Object.entries(out)))if(f.endsWith('.js')){const test=path.join(tmp,i+'.mjs');fs.writeFileSync(test,s);const r=spawnSync(process.execPath,['--check',test],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||String(r.error));}}finally{fs.rmSync(tmp,{recursive:true,force:true});}
 const backup=fs.mkdtempSync('update-backup-');for(const [f,b] of Object.entries(originals)){const dest=path.join(backup,f);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,b);}
 for(const [f,s] of Object.entries(out)){written.push(f);fs.writeFileSync(f,s);}
 console.log('Updated: '+Object.keys(out).join(', ')+'\nBackup: '+backup);
}catch(e){for(const f of written)try{fs.writeFileSync(f,originals[f]);}catch{}console.error(e.message);process.exitCode=1;}
