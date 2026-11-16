import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { check } from './domain.js';
const scrypt=promisify(scryptCallback);
export async function hashPassword(password) {
 check(typeof password==='string' && password.length>=10 && password.length<=128,'Пароль: от 10 до 128 символов');
 const salt=randomBytes(16).toString('hex'); const hash=await scrypt(password,salt,64);
 return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password,encoded) {
 if(typeof password!=='string' || password.length>128 || !encoded) return false;
 const [salt,hash]=encoded.split(':'); const actual=await scrypt(password,salt,64);
 return timingSafeEqual(actual,Buffer.from(hash,'hex'));
}
