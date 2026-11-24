const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const root=process.cwd();
const patch=JSON.parse(fs.readFileSync(path.join(__dirname,'changes.json'),'utf8'));
const expected={'public/app.js':'e6ffeba30a024534fb70529b18784aace91e84a1','public/styles.css':'59f47f9f06912716a7934487bb3de49adf171355','server/api.js':'bc0c765506059ee6b9031d703362bf99bf33b9ab'};
function blob(s){const b=Buffer.from(s);return crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');}
function replaceOnce(s,old,value){if(s.split(old).length!==2)throw Error('Expected exactly one source match: '+old.slice(0,90));return s.replace(old,()=>value);}
const original={},updated={};
let backup=null,written=[];
try{
 for(const [name,hash]of Object.entries(expected)){
  const file=path.join(root,name);original[name]=fs.readFileSync(file);const source=original[name].toString('utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');
  if(blob(source)!==hash)throw Error('Different source version: '+name+'. No files changed. Use the repository version this update was prepared for.');
  updated[name]=source;
 }
 for(const [name,body]of Object.entries(patch.functions)){
  // Function boundaries are top-level declarations in this source version.
  const start=new RegExp('^(?:async )?function '+name+'\\(','m').exec(updated['public/app.js']);
  if(!start)throw Error('Function missing: '+name);
  const tail=updated['public/app.js'].slice(start.index+start[0].length);
  const next=/^(?:async )?function /m.exec(tail);
  if(!next)throw Error('Next function boundary missing: '+name);
  const end=start.index+start[0].length+next.index;
  updated['public/app.js']=updated['public/app.js'].slice(0,start.index)+body+'\n'+updated['public/app.js'].slice(end);
 }
 let api=updated['server/api.js'];
 const lines=api.split('\n'),indices=lines.map((line,i)=>line.startsWith('  rows=rows.filter(b=>')?i:-1).filter(i=>i>=0);
 if(indices.length!==1)throw Error('Catalogue filter not found');lines[indices[0]]=patch.filterLine;api=lines.join('\n');
 api=replaceOnce(api,'export async function api(',patch.validation+'\nexport async function api(');
 api=replaceOnce(api,'  const extra=JSON.stringify(body.extra??{});',"  validatePersonExtra(kind,body.extra??{});\n  const extra=JSON.stringify(body.extra??{});");
 api=replaceOnce(api,"else {const name=str(body.name,'Название',150);const extra=JSON.stringify(body.extra??{});", "else {validatePersonExtra(old.kind,body.extra??{});const name=str(body.name,'Название',150);const extra=JSON.stringify(body.extra??{});");
 updated['server/api.js']=api;updated['public/styles.css']+='\n'+patch.css;
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'library-check-'));
 try{
  for(const [name,source]of Object.entries(updated))if(name.endsWith('.js')){
   const file=path.join(tmp,path.basename(name)+'.mjs');fs.writeFileSync(file,source,'utf8');
   const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
   if(result.error||result.status!==0)throw Error('Syntax check failed for '+name+'\n'+(result.stderr||result.error));
  }
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
 backup=path.join(root,'update-backup-'+new Date().toISOString().replace(/[:.]/g,'-'));
 for(const [name,buffer]of Object.entries(original)){const file=path.join(backup,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buffer);}
 for(const [name,source]of Object.entries(updated)){written.push(name);fs.writeFileSync(path.join(root,name),source,'utf8');}
 console.log('Updated:');Object.keys(updated).forEach(name=>console.log('  '+name));
 console.log('Backup: '+backup);console.log('Database unchanged. Restart the server, then press Ctrl+F5 in your browser.');
}catch(error){
 for(const name of written)try{fs.writeFileSync(path.join(root,name),original[name]);}catch{}
 console.error(error.message);process.exitCode=1;
}
