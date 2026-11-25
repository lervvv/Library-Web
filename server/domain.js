export class AppError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export function check(condition, message, status = 400) {
  if (!condition) throw new AppError(status, message);
}
export function str(value, label, max = 200, required = true) {
  check(typeof value === 'string', `${label}: требуется строка`);
  const result = value.trim();
  check((!required || result.length > 0) && result.length <= max, `${label}: от ${required ? 1 : 0} до ${max} символов`);
  return result;
}
export function int(value, label, min = 1, max = 1000000) {
  check(typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max, `${label}: целое число от ${min} до ${max}`);
  return value;
}
export function oneOf(value, values, label) {
  check(values.includes(value), `${label}: недопустимое значение`); return value;
}
export const today = () => new Date().toISOString().slice(0, 10);
export function date(value, label = 'Дата') {
  check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, `${label}: неверная дата`);
  return value;
}
export function addDays(value, days) { const d = new Date(value); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0,10); }
export function age(birth, now = today()) {
  let n = Number(now.slice(0,4)) - Number(birth.slice(0,4));
  if (now.slice(5) < birth.slice(5)) n--; return n;
}
export function overdue(due, end = today()) { return Math.max(0, Math.round((Date.parse(end)-Date.parse(due))/86400000)); }
export const policies = { Schoolboy: { limit:3, days:14 }, Student:{limit:5, days:21}, Pensioner:{limit:5, days:21}, Adult:{limit:7, days:30} };
export function validateReader(b) {
  const email = str(b.email,'Email',150).toLowerCase();
  check(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),'Некорректный email');
  const phone = str(b.phone,'Телефон',30).replace(/[\s()\-]/g,'');
  check(/^\+375\d{9}$/.test(phone),'Телефон: +375 и 9 цифр');
  const birth_date = date(b.birth_date,'Дата рождения');
  check(birth_date >= '1900-01-01' && birth_date <= today(),'Некорректная дата рождения');
  return { email, name:str(b.name,'Имя',45), surname:str(b.surname,'Фамилия',45), patronymic:str(b.patronymic ?? '','Отчество',45,false), birth_date, phone, address:str(b.address ?? '','Адрес',200,false) };
}
export function validateEligibility(reader, book, count) {
  check(reader && reader.active === 1,'Получатель не найден или заблокирован');
  check(age(reader.birth_date) >= book.age_limit,'Возраст читателя ниже ограничения книги');
  check(count < policies[reader.role==='reader'?reader.category:'Adult'].limit,'Достигнут лимит одновременных выдач');
}
