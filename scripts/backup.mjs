import { DatabaseSync, backup } from "node:sqlite";
import { mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.env.DATABASE_PATH || resolve(root, "data/micro.sqlite");
if (!existsSync(source)) {
  console.error("Ma’lumotlar bazasi topilmadi. Avval saytni ishga tushiring.");
  process.exit(1);
}
const directory = process.env.BACKUP_PATH || resolve(root, "backups");
mkdirSync(directory, { recursive: true });
const target = resolve(directory, `elastic-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`);
const db = new DatabaseSync(source, { readOnly: true });
try {
  await backup(db, target);
  console.log(`Backup saved: ${target}`);
} finally { db.close(); }
