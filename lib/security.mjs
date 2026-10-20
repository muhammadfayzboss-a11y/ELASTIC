import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
const scrypt = promisify(scryptCallback);
export const randomToken = () => randomBytes(32).toString("base64url");
export const hash = value => createHash("sha256").update(value).digest("hex");

export async function passwordHash(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt:${salt}:${key.toString("hex")}`;
}
export async function verifyPassword(password, stored) {
  const [, salt, expected] = stored.split(":");
  const key = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 });
  const target = Buffer.from(expected, "hex");
  return target.length === key.length && timingSafeEqual(target, key);
}
export function safeEqual(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && timingSafeEqual(x, y);
}
export function cookieToken(req) {
  return (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith("micro_session="))?.slice(14) || "";
}
