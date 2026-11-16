import { get,run,db } from './db.js';
import { hashPassword } from './security.js';
const email=(process.env.ADMIN_EMAIL||'admin@library.local').trim().toLowerCase();
if(!process.env.ADMIN_PASSWORD) throw new Error('Set ADMIN_PASSWORD (at least 10 characters) before running npm run admin');
if(get('SELECT id FROM users WHERE email=?',email)) throw new Error('Email already exists; no changes made');
run("INSERT INTO users(email,password,name,surname,birth_date,phone,role) VALUES(?,?,?,?,?,?,?)",email,await hashPassword(process.env.ADMIN_PASSWORD),'Администратор','Библиотеки','1990-01-01',process.env.ADMIN_PHONE||'+375000000000','admin');
console.log(`Administrator created: ${email}`); db.close();
