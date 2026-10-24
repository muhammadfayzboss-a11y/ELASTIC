import test from "node:test";
import assert from "node:assert/strict";
import { backup, DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { openDatabase } from "../lib/db.mjs";

test("existing v1 SQLite data migrates without loss; an online backup includes committed price revisions", async () => {
  const id = `micro-storage-test-${randomUUID()}`;
  const source = join(tmpdir(), `${id}.sqlite`), copy = join(tmpdir(), `${id}-backup.sqlite`);
  let db;
  try {
    db = openDatabase(source);
    // Simulate the previously delivered schema before testing the v2 upgrade.
    db.exec("ALTER TABLE assignments DROP COLUMN end_reason; ALTER TABLE assignments DROP COLUMN end_note; PRAGMA user_version=1;");
    db.exec(`
      INSERT INTO users(id,username,name,password_hash,role,created_at) VALUES(1,'test','Test','not-a-real-password','student','2026-10-20T00:00:00Z');
      INSERT INTO groups(id,name,created_at) VALUES(1,'Test','2026-10-20T00:00:00Z');
      INSERT INTO products(id,group_id,category,name_uz,name_en,name_ru,unit) VALUES(1,1,'fruit','Olma','Apple','Яблоко','kg');
      INSERT INTO assignments(id,group_id,user_id,product_id,started_at) VALUES(1,1,1,1,'2026-10-20T00:00:00Z');
      INSERT INTO periods(id,group_id,period_key,start_at) VALUES(1,1,'manual:test','2026-10-20T00:00:00Z');
      INSERT INTO submissions(id,group_id,assignment_id,period_id,created_at) VALUES(1,1,1,1,'2026-10-20T01:00:00Z');
      INSERT INTO price_revisions(submission_id,version,observed_on,korzinka,secondary_store,secondary,local_store,local,created_at)
        VALUES(1,1,'2026-10-20',1500000,'Havas',1400000,'Test shop',1300000,'2026-10-20T01:00:00Z');
      INSERT INTO price_revisions(submission_id,version,observed_on,korzinka,secondary_store,secondary,local_store,local,created_at)
        VALUES(1,2,'2026-10-20',1600000,'Mall',NULL,'Test shop',1300000,'2026-10-20T02:00:00Z');
    `);
    await backup(db, copy);
    db.close(); db = openDatabase(source);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 4);
    assert.ok(db.prepare("PRAGMA table_info(assignments)").all().some(column => column.name === "end_reason"));
    assert.equal(db.prepare("SELECT end_reason,end_note FROM assignments WHERE id=1").get().end_reason, null);
    assert.equal(db.prepare("SELECT end_note FROM assignments WHERE id=1").get().end_note, "");
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM price_revisions").get().n, 2);
    assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    db.close(); db = openDatabase(source); // Migration must also be safe on subsequent starts.
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM price_revisions").get().n, 2);
    const saved = new DatabaseSync(copy, { readOnly: true });
    try {
      assert.equal(saved.prepare("SELECT COUNT(*) AS n FROM price_revisions").get().n, 2);
      assert.equal(saved.prepare("SELECT korzinka FROM price_revisions WHERE version=2").get().korzinka, 1600000);
      assert.equal(saved.prepare("PRAGMA integrity_check").get().integrity_check, "ok");
    } finally { saved.close(); }
  } finally {
    if (db) db.close();
    // Only these uniquely named test files are removed; never a directory.
    for (const path of [source, `${source}-wal`, `${source}-shm`, copy, `${copy}-wal`, `${copy}-shm`]) rmSync(path, { force: true });
  }
});
