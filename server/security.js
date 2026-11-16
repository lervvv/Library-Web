import { randomBytes, createHash } from 'node:crypto';
import { get, run } from './db.js';
import { check } from './domain.js';
export { hashPassword, verifyPassword } from './passwords.js';
export const hashToken = value => createHash('sha256').update(value).digest('hex');
export function cookie(token,maxAge) { return `library_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`; }
export function session(req) {
 const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('library_session='))?.slice(16);
 if(!token || !/^[a-f0-9]{64}$/.test(token)) return null;
 const s=get('SELECT s.*,u.active FROM sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=? AND expires_at>?',hashToken(token),Date.now());
 if(!s || !s.active) return null;
 return {...s,user:get('SELECT * FROM users WHERE id=?',s.user_id)};
}
export function createSession(userId,res) {
 const token=randomBytes(32).toString('hex'), csrf=randomBytes(32).toString('hex');
 run('INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)',hashToken(token),userId,csrf,Date.now()+8*3600000);
 res.setHeader('Set-Cookie',cookie(token,8*3600)); return csrf;
}
const attempts=new Map();
export function rateLimit(key,max=20) {
 const now=Date.now(); let row=attempts.get(key);
 if(!row || now-row.start>15*60000) { row={start:now,count:0}; attempts.set(key,row); }
 check(++row.count<=max,'Слишком много попыток. Повторите через 15 минут',429);
 if(attempts.size>10000) for(const [k,v] of attempts) if(now-v.start>15*60000) attempts.delete(k);
}
