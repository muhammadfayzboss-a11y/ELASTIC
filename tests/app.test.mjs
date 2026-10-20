import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../lib/app.mjs";
import { passwordHash } from "../lib/security.mjs";
import { windowFor } from "../lib/schedule.mjs";
import { catalog } from "../lib/catalog.mjs";

const PASSWORD = "OnlyForAutomatedTests!27";
async function fixture(t) {
  let clock = "2026-10-20T07:00:00.000Z";
  const app = createApp({ now: () => clock, setupToken: "automated-test-setup-token" });
  app.server.listen(0, "127.0.0.1"); await once(app.server, "listening");
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); app.db.close(); });
  class Client {
    cookie = ""; csrf = ""; user = null;
    async request(path, method = "GET", data, extras = {}) {
      const response = await fetch(`${origin}/api${path}`, {
        method, headers: {
          Origin: origin, "Content-Type": "application/json",
          ...(this.cookie ? { Cookie: this.cookie } : {}), ...(this.csrf ? { "X-CSRF-Token": this.csrf } : {}), ...extras
        }, ...(data !== undefined ? { body: JSON.stringify(data) } : {})
      });
      const cookie = response.headers.get("set-cookie");
      if (cookie) this.cookie = cookie.split(";")[0];
      const json = await response.json();
      if (json.csrf) this.csrf = json.csrf;
      if (json.user) this.user = json.user;
      return { status: response.status, ...json };
    }
    async ok(path, method = "GET", data) {
      const result = await this.request(path, method, data);
      assert.ok(result.status >= 200 && result.status < 300, `${method} ${path}: ${JSON.stringify(result)}`);
      return result;
    }
  }
  const admin = new Client();
  await admin.ok("/setup", "POST", { token: app.setupToken, username: "teacher", name: "Test Teacher", password: PASSWORD });
  async function group(name = "Economics", keys = catalog.map(p => p.key)) {
    const result = await admin.ok("/groups", "POST", { name, productKeys: keys });
    return result.id;
  }
  async function invite(groupId, constraints = {}) {
    return admin.ok(`/groups/${groupId}/invites`, "POST", constraints);
  }
  async function student(groupId, username, options = {}) {
    const link = await invite(groupId), client = new Client();
    await client.ok("/register", "POST", { token: link.token, username, name: username, password: PASSWORD, ...options });
    return client;
  }
  const price = assignmentId => ({ assignmentId, observedOn: "2026-10-20", korzinka: 15000.5,
    secondaryStore: "Havas", secondary: 14500, localStore: "Chorsu shop", local: 13000 });
  return { app, origin, Client, admin, group, invite, student, price, setClock: value => { clock = value; } };
}

test("catalog contains exactly the supplied 50 products, including distinct corn entries", () => {
  assert.equal(catalog.length, 50);
  for (const [category, n] of [["fruit", 20], ["vegetable", 20], ["grain", 10]]) assert.equal(catalog.filter(p => p.category === category).length, n);
  assert.equal(new Set(catalog.map(p => p.key)).size, 50);
  assert.equal(catalog.filter(p => p.name_uz === "Makkajo‘xori").length, 2);
});

test("initial setup is secret-protected, one-time, and creates a teacher with hashed credentials", async t => {
  const { app, admin, Client } = await fixture(t);
  assert.equal((await admin.ok("/session")).user.role, "admin");
  const anonymous = new Client();
  assert.equal((await anonymous.request("/setup", "POST", { token: app.setupToken, username: "evil", name: "Evil", password: PASSWORD })).status, 403);
  const stored = app.db.prepare("SELECT password_hash FROM users").get().password_hash;
  assert.notEqual(stored, PASSWORD); assert.match(stored, /^scrypt:/);
  assert.equal((await anonymous.request("/groups")).status, 401);
  assert.equal((await anonymous.request("/login", "POST", { username: "teacher", password: "wrong" })).status, 401);
  await anonymous.ok("/login", "POST", { username: "teacher", password: PASSWORD });
  await anonymous.ok("/logout", "POST", {});
  assert.equal((await anonymous.request("/groups")).status, 401);
});

test("invite registration needs a valid link; revoked, expired and exhausted links are rejected", async t => {
  const { admin, group, invite, Client, setClock } = await fixture(t);
  const id = await group();
  const revoked = await invite(id);
  await admin.ok(`/groups/${id}/invites/${revoked.id}`, "DELETE", {});
  const anonymous = new Client();
  for (const token of ["bad", revoked.token]) {
    assert.equal((await anonymous.request("/register", "POST", { token, username: "student1", name: "Test Student", password: PASSWORD })).status, 410);
  }
  const expires = await invite(id, { expiresAt: "2026-10-20T08:00:00Z" });
  setClock("2026-10-20T08:00:00.000Z");
  assert.equal((await anonymous.request("/invites/inspect", "POST", { token: expires.token })).status, 410);
  const limited = await invite(id, { maxUses: 1 });
  await anonymous.ok("/register", "POST", { token: limited.token, username: "student1", name: "Test Student", password: PASSWORD });
  const another = new Client();
  assert.equal((await another.request("/register", "POST", { token: limited.token, username: "student2", name: "Another Student", password: PASSWORD })).status, 410);
  assert.equal((await anonymous.ok("/groups")).groups.length, 1);
});

test("group boundaries are enforced by API for students and unrelated teachers", async t => {
  const { app, admin, group, student, Client } = await fixture(t);
  const a = await group("Group A"), b = await group("Group B");
  const alice = await student(a, "alice"), bob = await student(b, "bob");
  assert.deepEqual((await alice.ok("/groups")).groups.map(g => g.id), [a]);
  for (const route of [`/groups/${b}`, `/groups/${b}/history`, `/groups/${b}/members`, `/groups/${b}/assignments`]) {
    assert.equal((await alice.request(route)).status, 403);
  }
  assert.equal((await bob.request(`/groups/${a}`)).status, 403);
  for (const route of ["invites", "members", "audit"]) assert.equal((await alice.request(`/groups/${a}/${route}`)).status, 403);
  assert.equal((await alice.request("/groups", "POST", { name: "Forbidden" })).status, 403);
  const pass = await passwordHash(PASSWORD);
  app.db.prepare("INSERT INTO users(username,name,password_hash,role,created_at) VALUES(?,?,?,'admin',?)").run("otherteacher", "Other Teacher", pass, "2026-10-20T00:00:00Z");
  const other = new Client();
  await other.ok("/login", "POST", { username: "otherteacher", password: PASSWORD });
  assert.equal((await other.ok("/groups")).groups.length, 0);
  assert.equal((await other.request(`/groups/${a}`)).status, 403);
  assert.equal((await admin.ok("/groups")).groups.length, 2);
});

test("simultaneous product claims have one winner and each group has independent inventory", async t => {
  const { admin, group, student } = await fixture(t);
  const a = await group("Group A"), b = await group("Group B");
  const alice = await student(a, "alice"), bob = await student(a, "bob"), carol = await student(b, "carol");
  const pa = (await admin.ok(`/groups/${a}`)).products[0], pb = (await admin.ok(`/groups/${b}`)).products[0];
  const results = await Promise.all([alice.request(`/groups/${a}/assign`, "POST", { productId: pa.id }), bob.request(`/groups/${a}/assign`, "POST", { productId: pa.id })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
  await carol.ok(`/groups/${b}/assign`, "POST", { productId: pb.id });
  assert.equal((await carol.ok(`/groups/${b}`)).assignment.product_id, pb.id);
  assert.equal((await alice.request(`/groups/${a}/assign`, "POST", { productId: pb.id })).status, 404);
});

test("changing products releases the old product and preserves all revisions and assignment history", async t => {
  const { admin, group, student, price } = await fixture(t);
  const id = await group(), alice = await student(id, "alice"), bob = await student(id, "bob");
  const products = (await alice.ok(`/groups/${id}`)).products;
  const first = await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[0].id });
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "manual", open: true });
  await alice.ok(`/groups/${id}/submissions`, "POST", price(first.id));
  await alice.ok(`/groups/${id}/submissions`, "POST", { ...price(first.id), korzinka: 17000, secondary: null });
  const second = await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[1].id, reason: "discontinued", reasonNote: "Store stopped selling it." });
  await alice.ok(`/groups/${id}/submissions`, "POST", price(second.id));
  assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", price(first.id))).status, 409);
  await bob.ok(`/groups/${id}/assign`, "POST", { productId: products[0].id });
  const history = await alice.ok(`/groups/${id}/history`);
  assert.equal(history.total, 2);
  const old = history.records.find(r => r.assignment_id === first.id);
  assert.equal(old.revisions.length, 2);
  assert.equal(old.revisions[0].korzinka, 1700000);
  assert.equal(old.revisions[1].korzinka, 1500050);
  assert.equal(old.revisions[0].secondary, null);
  assert.ok(old.ended_at);
  assert.equal(old.end_reason, "discontinued");
  assert.equal(old.end_note, "Store stopped selling it.");
  assert.equal((await bob.ok(`/groups/${id}/history`)).total, 0);
  assert.equal((await bob.ok(`/groups/${id}/history?member=${alice.user.id}`)).total, 0);
  assert.equal((await admin.ok(`/groups/${id}/history?member=${alice.user.id}`)).total, 2);
  assert.equal((await alice.ok(`/groups/${id}/assignments`)).assignments.length, 2);
});

test("a failed product switch leaves the previous active assignment intact", async t => {
  const { group, student } = await fixture(t);
  const id = await group(), alice = await student(id, "alice"), bob = await student(id, "bob");
  const products = (await alice.ok(`/groups/${id}`)).products;
  await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[0].id });
  await bob.ok(`/groups/${id}/assign`, "POST", { productId: products[1].id });
  assert.equal((await alice.request(`/groups/${id}/assign`, "POST", { productId: products[1].id })).status, 409);
  assert.equal((await alice.ok(`/groups/${id}`)).assignment.product_id, products[0].id);
});

test("switch reasons are required server-side, recorded in history and audit, and private to the member and teacher", async t => {
  const { admin, group, student } = await fixture(t);
  const id = await group(), alice = await student(id, "alice"), bob = await student(id, "bob");
  const products = (await alice.ok(`/groups/${id}`)).products;
  await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[0].id });
  for (const extra of [{}, { reason: "invented" }, { reason: "member_removed" }]) {
    const result = await alice.request(`/groups/${id}/assign`, "POST", { productId: products[1].id, ...extra });
    assert.equal(result.error, "CHANGE_REASON_REQUIRED");
  }
  for (const note of ["", "    ", "abcd"]) {
    assert.equal((await alice.request(`/groups/${id}/assign`, "POST", { productId: products[1].id, reason: "other", reasonNote: note })).error, "CHANGE_NOTE_REQUIRED");
  }
  assert.equal((await alice.ok(`/groups/${id}`)).assignment.product_id, products[0].id);
  await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[1].id, reason: "other", reasonNote: "  Qadoq hajmi o‘zgargan.  " });
  const own = (await alice.ok(`/groups/${id}/assignments`)).assignments;
  const ended = own.find(a => a.ended_at);
  assert.equal(ended.end_reason, "other");
  assert.equal(ended.end_note, "Qadoq hajmi o‘zgargan.");
  assert.equal((await bob.ok(`/groups/${id}/assignments`)).assignments.length, 0);
  const teacherHistory = (await admin.ok(`/groups/${id}/assignments`)).assignments;
  assert.equal(teacherHistory.find(a => a.id === ended.id).end_reason, "other");
  const event = (await admin.ok(`/groups/${id}/audit`)).events.find(e => e.action === "product_changed");
  assert.deepEqual(JSON.parse(event.details), { from: products[0].id, to: products[1].id, reason: "other", note: "Qadoq hajmi o‘zgargan." });
  await alice.ok(`/groups/${id}/assign`, "POST", { productId: products[2].id, reason: "seasonal" });
  assert.equal((await alice.ok(`/groups/${id}/assignments`)).assignments.find(a => a.product_id === products[1].id).end_reason, "seasonal");
});

test("server enforces entry windows, scheduled boundaries and separate weekly periods", async t => {
  const { admin, group, student, price, setClock } = await fixture(t);
  const id = await group(), alice = await student(id, "alice");
  const product = (await alice.ok(`/groups/${id}`)).products[0];
  const assignment = await alice.ok(`/groups/${id}/assign`, "POST", { productId: product.id });
  assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", price(assignment.id))).error, "WINDOW_CLOSED");
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "single", start: "2026-10-20T08:00:00Z", end: "2026-10-20T09:00:00Z" });
  assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", price(assignment.id))).status, 409);
  setClock("2026-10-20T08:00:00.000Z");
  await alice.ok(`/groups/${id}/submissions`, "POST", price(assignment.id));
  setClock("2026-10-20T09:00:00.000Z");
  assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", price(assignment.id))).status, 409);
  // Tuesday, 14:00 Tashkent == 09:00 UTC.
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "weekly", weekday: 2, minute: 840, durationMinutes: 60 });
  await alice.ok(`/groups/${id}/submissions`, "POST", price(assignment.id));
  // Renew login before session expiry to test the following week's independent record.
  setClock("2026-10-27T09:00:00.000Z");
  await alice.ok("/login", "POST", { username: "alice", password: PASSWORD });
  await alice.ok(`/groups/${id}/submissions`, "POST", { ...price(assignment.id), observedOn: "2026-10-27" });
  assert.equal((await alice.ok(`/groups/${id}/history`)).total, 3);
});

test("weekly schedule handles Tashkent midnight, cross-week windows and exact closing time", () => {
  const schedule = { mode: "weekly", revision: 1, weekday: 0, minute: 23 * 60, duration_minutes: 180 };
  const before = windowFor(schedule, "2026-10-25T17:59:59Z");
  const open = windowFor(schedule, "2026-10-25T18:00:00Z");
  const monday = windowFor(schedule, "2026-10-25T20:30:00Z");
  const closed = windowFor(schedule, "2026-10-25T21:00:00Z");
  assert.equal(before.open, false); assert.equal(open.open, true); assert.equal(monday.open, true); assert.equal(closed.open, false);
  assert.equal(open.start, "2026-10-25T18:00:00.000Z");
  assert.equal(open.key, monday.key);
  assert.equal(closed.next, "2026-11-01T18:00:00.000Z");
});

test("invalid prices, dates and schedules are rejected; zero differs from unavailable", async t => {
  const { admin, group, student, price } = await fixture(t);
  const id = await group(), alice = await student(id, "alice");
  const product = (await alice.ok(`/groups/${id}`)).products[0];
  const assignment = await alice.ok(`/groups/${id}/assign`, "POST", { productId: product.id });
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "manual", open: true });
  for (const val of [0, -1, 100000001, 1.001, "15000"]) {
    assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", { ...price(assignment.id), korzinka: val })).error, "PRICE_INVALID");
  }
  for (const day of ["2026-10-21", "2026-10-19", "2026-02-30"]) {
    assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", { ...price(assignment.id), observedOn: day })).error, "DATE_INVALID");
  }
  await alice.ok(`/groups/${id}/submissions`, "POST", { ...price(assignment.id), korzinka: null, secondary: null, local: null });
  assert.equal((await admin.request(`/groups/${id}/schedule`, "POST", { mode: "single", start: "2026-10-21T00:00:00Z", end: "2026-10-20T00:00:00Z" })).error, "SCHEDULE_INVALID");
});

test("CSRF and origin checks protect authenticated writes", async t => {
  const { admin } = await fixture(t);
  assert.equal((await admin.request("/groups", "POST", { name: "Bad" }, { "X-CSRF-Token": "" })).error, "CSRF_INVALID");
  assert.equal((await admin.request("/groups", "POST", { name: "Bad" }, { Origin: "https://attacker.example" })).error, "ORIGIN_INVALID");
  assert.equal((await admin.ok("/groups")).groups.length, 0);
});

test("archiving blocks writes but keeps history; removing a member releases their product", async t => {
  const { admin, group, student, price } = await fixture(t);
  const id = await group(), alice = await student(id, "alice");
  const product = (await alice.ok(`/groups/${id}`)).products[0];
  const assignment = await alice.ok(`/groups/${id}/assign`, "POST", { productId: product.id });
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "manual", open: true });
  await alice.ok(`/groups/${id}/submissions`, "POST", price(assignment.id));
  await admin.ok(`/groups/${id}/archive`, "POST", { archived: true });
  assert.equal((await alice.request(`/groups/${id}/submissions`, "POST", price(assignment.id))).error, "GROUP_ARCHIVED");
  assert.equal((await alice.ok(`/groups/${id}/history`)).total, 1);
  await admin.ok(`/groups/${id}/archive`, "POST", { archived: false });
  await admin.ok(`/groups/${id}/members/${alice.user.id}/remove`, "POST", {});
  assert.equal((await alice.request(`/groups/${id}`)).status, 403);
  assert.equal((await admin.ok(`/groups/${id}/history`)).total, 1);
  assert.equal((await admin.ok(`/groups/${id}`)).products.find(p => p.id === product.id).owner_id, null);
});

test("password reset invalidates existing sessions; students can change their own password", async t => {
  const { admin, group, student, Client } = await fixture(t);
  const id = await group(), alice = await student(id, "alice"), originalCookie = alice.cookie;
  const reset = "NewTestPassword!456";
  await admin.ok(`/groups/${id}/members/${alice.user.id}/password`, "POST", { password: reset });
  assert.equal((await alice.request("/groups")).status, 401);
  await alice.ok("/login", "POST", { username: "alice", password: reset });
  await alice.ok("/account/password", "POST", { current: reset, password: PASSWORD });
  const old = new Client(); old.cookie = originalCookie;
  assert.equal((await old.request("/groups")).status, 401);
  const fresh = new Client();
  await fresh.ok("/login", "POST", { username: "alice", password: PASSWORD });
});

test("CSV includes all revisions and neutralizes spreadsheet formulas", async t => {
  const { origin, admin, group, student, price } = await fixture(t);
  const id = await group(), alice = await student(id, "alice", { name: "=2+2" });
  const product = (await alice.ok(`/groups/${id}`)).products[0];
  const assignment = await alice.ok(`/groups/${id}/assign`, "POST", { productId: product.id });
  await admin.ok(`/groups/${id}/schedule`, "POST", { mode: "manual", open: true });
  await alice.ok(`/groups/${id}/submissions`, "POST", price(assignment.id));
  await alice.ok(`/groups/${id}/submissions`, "POST", { ...price(assignment.id), local: 12000 });
  const response = await fetch(`${origin}/api/groups/${id}/export`, { headers: { Cookie: admin.cookie } });
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert.match(csv, /"'=2\+2"/); assert.equal(csv.split("\r\n").length, 3);
  assert.match(csv, /"15000\.5"/);
});

test("static responses include security headers and do not serve database files", async t => {
  const { origin } = await fixture(t);
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-security-policy"), /script-src 'self'/);
  assert.equal(page.headers.get("x-frame-options"), "DENY");
  assert.equal((await fetch(`${origin}/data/micro.sqlite`)).status, 404);
  assert.equal((await fetch(`${origin}/lib/app.mjs`)).status, 404);
});


test("Render health probe accepts internal Host without exposing app routes", async t => {
  const app = createApp({ publicUrl: "https://elastic-test.example" });
  app.server.listen(0, "127.0.0.1"); await once(app.server, "listening");
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  t.after(async () => { app.server.closeAllConnections(); await new Promise(resolve => app.server.close(resolve)); app.db.close(); });
  const headers = { Host: "render-internal" };
  const response = await fetch(`${origin}/healthz`, { headers });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  const head = await fetch(`${origin}/healthz`, { headers, method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal((await fetch(`${origin}/api/session`, { headers })).status, 403);
  assert.equal((await fetch(`${origin}/healthz`, { headers, method: "POST" })).status, 403);
});
