import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const strongCost = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export function validatePasswordRecord(record) {
  if (!record || ![undefined,2].includes(record.version) || !/^[a-f0-9]{64}$/.test(record.salt) || !/^[a-f0-9]{128}$/.test(record.hash)) throw new Error('Invalid admin credential record.');
  return record;
}
export async function passwordRecord(password) {
  const salt = randomBytes(32).toString('hex');
  return { version: 2, salt, hash: (await derive(password,salt,64,strongCost)).toString('hex') };
}
export async function verifyPassword(password,record) {
  validatePasswordRecord(record);
  const derived = await derive(password,record.salt,64,record.version === 2 ? strongCost : { N:16384,r:8,p:1 });
  return timingSafeEqual(derived,Buffer.from(record.hash,'hex'));
}
