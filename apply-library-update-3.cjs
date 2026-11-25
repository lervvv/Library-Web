const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawnSync}=require('node:child_process');
const old={},out={},written=[];let file;
function sub(a,b){if(out[file].split(a).length!==2)throw Error('Source differs: '+file+' / '+a.slice(0,65));out[file]=out[file].replace(a,()=>b);}
try{
for(file of ['public/app.js','public/styles.css','server/api.js','server/domain.js','server/service.js']){old[file]=fs.readFileSync(file);out[file]=old[file].toString('utf8').replace(/\r\n/g,'\n');}
file='public/app.js';
sub("['users','Читатели']","['users','Читатели и сотрудники']");
sub("const readers=users.filter(u=>u.role==='reader'&&u.active)","const readers=users.filter(u=>u.active)");
sub("field('reader_id','Читатель','select',readers.map(u=>[u.id,`${u.surname} ${u.name} · ${u.phone}`]))","field('reader_id','Получатель','select',readers.map(u=>[u.id,`${u.surname} ${u.name} · ${label(u.role)} · ${u.phone}`]))");
sub("[r?.category]||30","[r?.role==='reader'?r.category:'Adult']||30");
sub("...(system?[]:[action('Добавить запись',()=>editRef({kind},kind))])","...(!system||admin?[action('Добавить запись',()=>editRef({kind},kind))]:[])");
sub("system?'Системные роли доступны только для просмотра.'","system?(admin?'Переименование обновляет связи. Удалять можно только неиспользуемые роли.':'Роли доступны для просмотра.')");
sub("system?null:r=>[action('Изменить'","system&&!admin?null:r=>[action('Изменить'");
sub("for(const [,role]of options('author_roles'))if(!roles.some(([key])=>key===role))roles.push([role,role]);","const availableRoles=new Set(options('author_roles').map(([,role])=>role));for(const role of availableRoles)if(!roles.some(([key])=>key===role))roles.push([role,role]);for(let i=roles.length-1;i>=0;i--)if(!availableRoles.has(roles[i][0]))roles.splice(i,1);");
sub("role:k==='authors'?'Author':''","role:k==='authors'?(options('author_roles').find(([,name])=>name==='Author')?.[1]||options('author_roles')[0]?.[1]||''):''");
sub("const p=document.createElement('div');p.className='panel';p.innerHTML=`<h2>${esc(u.surname)}", "root.classList.add('profile-view');const p=document.createElement('div');p.className='panel';p.innerHTML=`<p class=\"muted\">Контактные данные и сведения об учётной записи.</p><h2>${esc(u.surname)}");
sub("keys.map(k=>cell(r[k]))","keys.map(k=>cell(k==='created_at'&&r[k]?'UTC '+r[k]:r[k]))");
file='public/styles.css';out[file]+='\nheader{position:sticky;top:0;z-index:5}main:has(.profile-view){margin-block:0}.profile-view .toolbar{margin-bottom:12px}@media(max-width:760px){nav{position:static}}\n';
file='server/domain.js';
sub("reader && reader.active === 1 && reader.role === 'reader','Читатель не найден или заблокирован'","reader && reader.active === 1,'Получатель не найден или заблокирован'");
sub('policies[reader.category].limit',"policies[reader.role==='reader'?reader.category:'Adult'].limit");
file='server/service.js';
sub("b.days??policies[reader.category].days","b.days??policies[reader.role==='reader'?reader.category:'Adult'].days");
sub("loan.due_at,policies[reader.category].days","loan.due_at,policies[reader.role==='reader'?reader.category:'Adult'].days");
sub("x.role||'Author'","x.role||(get(\"SELECT name FROM refs WHERE kind='author_roles' ORDER BY (name='Author') DESC,id LIMIT 1\")?.name||'Author')");
file='server/api.js';
sub("check(kind!=='author_roles','Системные роли авторов нельзя добавлять',403);","if(kind==='author_roles') service.requireAdmin(u);");
sub("check(old.kind!=='author_roles','Системные роли авторов нельзя менять или удалять');",`if(old.kind==='author_roles') {
   service.requireAdmin(u);
   return send(tx(()=>{
    if(method==='DELETE'){
     check(!get('SELECT 1 FROM book_refs WHERE role=? UNION ALL SELECT 1 FROM document_refs WHERE role=? LIMIT 1',old.name,old.name),'Эта роль используется в книгах или произведениях',409);
     check(get("SELECT count(*) n FROM refs WHERE kind='author_roles'").n>1,'Нельзя удалить последнюю роль',409);
     run('DELETE FROM refs WHERE id=?',old.id);
    }else{
     const name=str(body.name,'Роль автора',45);
     run('UPDATE refs SET name=? WHERE id=?',name,old.id);
     run('UPDATE book_refs SET role=? WHERE role=?',name,old.name);
     run('UPDATE document_refs SET role=? WHERE role=?',name,old.name);
    }
    audit(u.id,method.toLowerCase(),'ref',old.id);return {ok:true};
   }));
  }`);
sub("const kind=oneOf(body.kind,service.kinds,'Справочник'),name=str(body.name,'Название',150);","const kind=oneOf(body.kind,service.kinds,'Справочник'),name=str(body.name,'Название',kind==='author_roles'?45:150);");
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lib-check-'));try{for(const [i,[f,s]] of Object.entries(Object.entries(out)))if(f.endsWith('.js')){const t=path.join(tmp,i+'.mjs');fs.writeFileSync(t,s);const r=spawnSync(process.execPath,['--check',t],{encoding:'utf8'});if(r.status!==0)throw Error(r.stderr||String(r.error));}}finally{fs.rmSync(tmp,{recursive:true,force:true});}
const backup=fs.mkdtempSync('update-backup-');for(const [f,b] of Object.entries(old)){const d=path.join(backup,f);fs.mkdirSync(path.dirname(d),{recursive:true});fs.writeFileSync(d,b);}
for(const [f,s] of Object.entries(out)){written.push(f);fs.writeFileSync(f,s);}console.log('Updated. Backup: '+backup);
}catch(e){for(const f of written)try{fs.writeFileSync(f,old[f]);}catch{}console.error(e.message);process.exitCode=1;}
