import http from "node:http";
import { storeKeys, coordinates, distanceMeters, locationError } from "./location.mjs";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase, transaction } from "./db.mjs";
import { catalog } from "./catalog.mjs";
import { randomToken, hash, passwordHash, verifyPassword, safeEqual, cookieToken } from "./security.mjs";
import { windowFor, localDate } from "./schedule.mjs";

class AppError extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}
const fail = (status, code) => { throw new AppError(status, code); };
const text = (value, min = 0, max = 150) => {
  if (typeof value !== "string") fail(400, "INVALID_INPUT");
  const result = value.trim();
  if (result.length < min || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(result)) fail(400, "INVALID_INPUT");
  return result;
};
const integer = (value, min, max) => {
  if (!Number.isInteger(value) || value < min || value > max) fail(400, "INVALID_INPUT");
  return value;
};
function accountInput(body) {
  const username = text(body.username, 3, 32).toLowerCase();
  if (!/^[a-z0-9_.-]+$/.test(username)) fail(400, "INVALID_USERNAME");
  const name = text(body.name, 2, 80);
  if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) fail(400, "PASSWORD_LENGTH");
  return { username, name, password: body.password };
}
const idOf = value => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail(400, "INVALID_INPUT");
  return id;
};
const iso = value => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) fail(400, "INVALID_INPUT");
  return new Date(value).toISOString();
};

export function createApp(options = {}) {
  const db = openDatabase(options.dbPath || ":memory:");
  const now = () => new Date(options.now ? options.now() : Date.now()).toISOString();
  const setupToken = options.setupToken || randomToken();
  const publicDir = options.publicDir || fileURLToPath(new URL("../public/", import.meta.url));
  const origin = options.publicUrl ? new URL(options.publicUrl).origin : null;
  const secure = origin?.startsWith("https://") || false;
  const rates = new Map();
  const get = (sql, ...args) => db.prepare(sql).get(...args);
  const all = (sql, ...args) => db.prepare(sql).all(...args);
  const run = (sql, ...args) => db.prepare(sql).run(...args);
  const needsSetup = () => !get("SELECT id FROM users LIMIT 1");
  const publicUser = user => ({ id: user.id, username: user.username, name: user.name, role: user.role });
  const audit = (groupId, userId, action, details = {}) =>
    run("INSERT INTO audit_events(group_id,actor_id,action,details,created_at) VALUES(?,?,?,?,?)",
      groupId, userId, action, JSON.stringify(details), now());
  function rateLimit(req, type, limit = 25) {
    const key = `${req.socket.remoteAddress}:${type}`, time = Date.now();
    if (rates.size > 5000) for (const [k, v] of rates) if (v.until < time) rates.delete(k);
    const entry = rates.get(key);
    if (!entry || entry.until <= time) rates.set(key, { count: 1, until: time + 15 * 60000 });
    else if (++entry.count > limit) fail(429, "TOO_MANY_ATTEMPTS");
  }
  function session(req) {
    const token = cookieToken(req);
    if (!token) return null;
    return get(`SELECT users.*,sessions.csrf,sessions.token_hash FROM sessions JOIN users ON users.id=sessions.user_id
      WHERE sessions.token_hash=? AND sessions.expires_at>?`, hash(token), now()) || null;
  }
  function createSession(res, userId) {
    const token = randomToken(), csrf = randomToken();
    run("DELETE FROM sessions WHERE expires_at<=?", now());
    run("INSERT INTO sessions(token_hash,user_id,csrf,expires_at) VALUES(?,?,?,?)",
      hash(token), userId, csrf, new Date(Date.parse(now()) + 7 * 86400000).toISOString());
    res.setHeader("Set-Cookie", `micro_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure ? "; Secure" : ""}`);
    return { user: publicUser(get("SELECT * FROM users WHERE id=?", userId)), csrf };
  }
  function access(user, groupId, admin = false, write = false) {
    if (!user) fail(401, "LOGIN_REQUIRED");
    const group = get("SELECT * FROM groups WHERE id=?", groupId);
    if (!group) fail(404, "NOT_FOUND");
    const isAdmin = Boolean(get("SELECT 1 FROM group_admins WHERE group_id=? AND user_id=?", groupId, user.id));
    const member = get("SELECT * FROM memberships WHERE group_id=? AND user_id=? AND active=1", groupId, user.id);
    if (!isAdmin && (!member || admin)) fail(403, "FORBIDDEN");
    if (write && group.archived) fail(409, "GROUP_ARCHIVED");
    return { ...group, isAdmin };
  }
  function inviteByToken(raw) {
    if (typeof raw !== "string" || raw.length > 100) fail(400, "INVITE_INVALID");
    const invite = get(`SELECT i.*,g.name AS group_name,g.description FROM invites i JOIN groups g ON g.id=i.group_id
      WHERE i.token_hash=? AND g.archived=0`, hash(raw));
    if (!invite || invite.revoked_at || (invite.expires_at && invite.expires_at <= now()) ||
      (invite.max_uses !== null && invite.uses >= invite.max_uses)) fail(410, "INVITE_INVALID");
    return invite;
  }
  function addMembership(invite, userId) {
    const existing = get("SELECT * FROM memberships WHERE group_id=? AND user_id=?", invite.group_id, userId);
    if (existing?.active) return;
    run(`INSERT INTO memberships(group_id,user_id,joined_at) VALUES(?,?,?)
      ON CONFLICT(group_id,user_id) DO UPDATE SET active=1,joined_at=excluded.joined_at`, invite.group_id, userId, now());
    run("UPDATE invites SET uses=uses+1 WHERE id=?", invite.id);
    audit(invite.group_id, userId, "member_joined");
  }
  function currentWindow(groupId) {
    return windowFor(get("SELECT * FROM schedules WHERE group_id=?", groupId), now());
  }
  function addCatalogProducts(groupId, keys) {
    if (!Array.isArray(keys) || keys.length > 50 || keys.some(k => !catalog.some(p => p.key === k))) fail(400, "INVALID_INPUT");
    for (const key of new Set(keys)) {
      const p = catalog.find(item => item.key === key);
      run(`INSERT INTO products(group_id,catalog_key,category,name_uz,name_en,name_ru,unit) VALUES(?,?,?,?,?,?,?)
        ON CONFLICT(group_id,catalog_key) DO UPDATE SET active=1`,
        groupId, key, p.category, p.name_uz, p.name_en, p.name_ru, p.unit);
    }
  }
  function history(user, groupId, params, exporting = false) {
    const group = access(user, groupId);
    const conditions = ["s.group_id=?"], values = [groupId];
    if (!group.isAdmin) { conditions.push("a.user_id=?"); values.push(user.id); }
    if (params.get("member")) { conditions.push("a.user_id=?"); values.push(idOf(params.get("member"))); }
    if (params.get("product")) { conditions.push("a.product_id=?"); values.push(idOf(params.get("product"))); }
    for (const [param, op] of [["from", ">="], ["to", "<="]]) {
      const date = params.get(param);
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(400, "INVALID_INPUT");
        conditions.push(`latest.observed_on${op}?`); values.push(date);
      }
    }
    if (params.get("category")) { conditions.push("p.category=?"); values.push(params.get("category")); }
    const joins = `FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN products p ON p.id=a.product_id
      JOIN users u ON u.id=a.user_id JOIN periods period ON period.id=s.period_id
      JOIN price_revisions latest ON latest.submission_id=s.id AND latest.version=(SELECT MAX(version) FROM price_revisions WHERE submission_id=s.id)
      WHERE ${conditions.join(" AND ")}`;
    const total = get(`SELECT COUNT(*) AS n ${joins}`, ...values).n;
    const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
    const limit = exporting ? 10000 : 30;
    if (exporting && total > limit) fail(400, "EXPORT_TOO_LARGE");
    const records = all(`SELECT s.id,s.created_at,a.id AS assignment_id,a.started_at,a.ended_at,a.end_reason,a.end_note,a.user_id,
      u.name AS member_name,u.username,p.id AS product_id,p.name_uz,p.name_en,p.name_ru,p.category,p.unit,
      period.start_at AS period_start,period.end_at AS period_end,latest.observed_on,
      latest.korzinka,latest.secondary_store,latest.secondary,latest.local_store,latest.local,latest.version,
      latest.created_at AS updated_at ${joins} ORDER BY latest.created_at DESC,s.id DESC LIMIT ? OFFSET ?`,
      ...values, limit, exporting ? 0 : (page - 1) * limit);
    for (const row of records) {
      row.revisions = all("SELECT * FROM price_revisions WHERE submission_id=? ORDER BY version DESC", row.id);
      const collected = new Set();
      for (const revision of [...row.revisions].reverse()) {
        revision.observations = all(`SELECT o.store_key,o.accuracy,o.measured_at,o.distance,l.name AS location_name
          FROM store_observations o JOIN store_locations l ON l.id=o.location_id WHERE o.revision_id=?`, revision.id);
        if (!revision.observations.length) for (const key of storeKeys) collected.add(key);
        else for (const observation of revision.observations) collected.add(observation.store_key);
        revision.collectedStores = [...collected];
      }
    }
    return { records, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  }
  async function bodyOf(req) {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 65536) fail(413, "REQUEST_TOO_LARGE");
      chunks.push(chunk);
    }
    try {
      const value = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      if (!value || typeof value !== "object" || Array.isArray(value)) fail(400, "INVALID_INPUT");
      return value;
    } catch (error) { if (error instanceof AppError) throw error; fail(400, "INVALID_INPUT"); }
  }
  const send = (res, value, status = 200) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(value));
  };

  async function api(req, res, url) {
    const path = url.pathname, method = req.method;
    const user = session(req);
    if (!["GET", "HEAD"].includes(method)) {
      // Host checks plus exact-origin checks prevent CSRF and DNS rebinding, including initial setup.
      const requestOrigin = origin || `http://${req.headers.host}`;
      if (req.headers.origin !== requestOrigin) fail(403, "ORIGIN_INVALID");
      if (user && !safeEqual(req.headers["x-csrf-token"], user.csrf)) fail(403, "CSRF_INVALID");
      if (!req.headers["content-type"]?.startsWith("application/json")) fail(415, "INVALID_INPUT");
    }
    const body = ["POST", "PUT", "PATCH", "DELETE"].includes(method) ? await bodyOf(req) : {};
    if (path === "/api/session" && method === "GET") {
      return send(res, { user: user ? publicUser(user) : null, csrf: user?.csrf || null, setupRequired: needsSetup(), serverTime: now() });
    }
    if (path === "/api/setup" && method === "POST") {
      rateLimit(req, "setup", 12);
      if (!needsSetup() || !safeEqual(body.token, setupToken)) fail(403, "SETUP_INVALID");
      const input = accountInput(body), pass = await passwordHash(input.password);
      const id = transaction(db, () => {
        if (!needsSetup()) fail(409, "SETUP_INVALID");
        return Number(run("INSERT INTO users(username,name,password_hash,role,created_at) VALUES(?,?,?,'admin',?)",
          input.username, input.name, pass, now()).lastInsertRowid);
      });
      return send(res, createSession(res, id), 201);
    }
    if (path === "/api/login" && method === "POST") {
      const username = text(body.username, 1, 32).toLowerCase();
      rateLimit(req, "login-ip", 300);
      rateLimit(req, `login:${username}`, 20);
      const password = typeof body.password === "string" && body.password.length <= 128 ? body.password : "";
      const account = get("SELECT * FROM users WHERE username=?", username);
      // Keep the expensive derivation even for unknown usernames.
      const valid = await verifyPassword(password, account?.password_hash || `scrypt:00000000000000000000000000000000:${"00".repeat(64)}`);
      if (!account || !valid) fail(401, "LOGIN_INVALID");
      return send(res, createSession(res, account.id));
    }
    if (path === "/api/logout" && method === "POST") {
      if (user) run("DELETE FROM sessions WHERE token_hash=?", user.token_hash);
      res.setHeader("Set-Cookie", `micro_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`);
      return send(res, { ok: true });
    }
    if (path === "/api/invites/inspect" && method === "POST") {
      rateLimit(req, "inspect", 300);
      const invite = inviteByToken(body.token);
      return send(res, { groupId: invite.group_id, name: invite.group_name, description: invite.description });
    }
    if (path === "/api/register" && method === "POST") {
      rateLimit(req, "register", 120);
      inviteByToken(body.token);
      const input = accountInput(body), pass = await passwordHash(input.password);
      const result = transaction(db, () => {
        const invite = inviteByToken(body.token);
        if (get("SELECT id FROM users WHERE username=?", input.username)) fail(409, "USERNAME_TAKEN");
        const id = Number(run("INSERT INTO users(username,name,password_hash,role,created_at) VALUES(?,?,?,'student',?)",
          input.username, input.name, pass, now()).lastInsertRowid);
        addMembership(invite, id);
        return { id, groupId: invite.group_id };
      });
      return send(res, { ...createSession(res, result.id), groupId: result.groupId }, 201);
    }
    if (!user) fail(401, "LOGIN_REQUIRED");
    if (path === "/api/join" && method === "POST") {
      if (user.role !== "student") fail(403, "STUDENT_ONLY");
      const groupId = transaction(db, () => { const invite = inviteByToken(body.token); addMembership(invite, user.id); return invite.group_id; });
      return send(res, { groupId });
    }
    if (path === "/api/account/password" && method === "POST") {
      rateLimit(req, "password", 12);
      if (typeof body.current !== "string" || body.current.length > 128 || !await verifyPassword(body.current, user.password_hash)) fail(400, "LOGIN_INVALID");
      if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) fail(400, "PASSWORD_LENGTH");
      const value = await passwordHash(body.password);
      transaction(db, () => {
        run("UPDATE users SET password_hash=? WHERE id=?", value, user.id);
        run("DELETE FROM sessions WHERE user_id=?", user.id);
      });
      return send(res, createSession(res, user.id));
    }
    if (path === "/api/maps/config" && method === "GET") {
      return send(res, { provider: options.mapApiKey ? "geoapify" : "openstreetmap", apiKey: options.mapApiKey || "" });
    }
    if (path === "/api/catalog" && method === "GET") return send(res, { products: catalog });
    if (path === "/api/groups" && method === "GET") {
      const groups = all(`SELECT g.* FROM groups g WHERE EXISTS(SELECT 1 FROM group_admins ga WHERE ga.group_id=g.id AND ga.user_id=?)
        OR EXISTS(SELECT 1 FROM memberships m WHERE m.group_id=g.id AND m.user_id=? AND m.active=1) ORDER BY g.archived,g.id DESC`, user.id, user.id);
      for (const group of groups) {
        group.members = get("SELECT COUNT(*) AS n FROM memberships WHERE group_id=? AND active=1", group.id).n;
        group.products = get("SELECT COUNT(*) AS n FROM products WHERE group_id=? AND active=1", group.id).n;
        group.assigned = get("SELECT COUNT(*) AS n FROM assignments WHERE group_id=? AND ended_at IS NULL", group.id).n;
        group.pendingRequests = get(`SELECT (SELECT COUNT(*) FROM product_change_requests WHERE group_id=? AND status='pending') +
          (SELECT COUNT(*) FROM store_locations WHERE group_id=? AND status='pending') AS n`, group.id, group.id).n;
        group.window = currentWindow(group.id);
        group.submitted = get(`SELECT COUNT(DISTINCT a.user_id) AS n FROM submissions s JOIN assignments a ON a.id=s.assignment_id
          JOIN periods p ON p.id=s.period_id JOIN memberships m ON m.user_id=a.user_id AND m.group_id=s.group_id AND m.active=1
          WHERE s.group_id=? AND p.period_key=? AND (
            (SELECT COUNT(DISTINCT o.store_key) FROM store_observations o JOIN price_revisions r ON r.id=o.revision_id WHERE r.submission_id=s.id)=3
            OR NOT EXISTS(SELECT 1 FROM store_observations o JOIN price_revisions r ON r.id=o.revision_id WHERE r.submission_id=s.id))`, group.id, group.window.key).n;
      }
      return send(res, { groups, serverTime: now() });
    }
    if (path === "/api/groups" && method === "POST") {
      if (user.role !== "admin") fail(403, "FORBIDDEN");
      const name = text(body.name, 2, 80), description = text(body.description || "", 0, 250);
      const id = transaction(db, () => {
        const groupId = Number(run("INSERT INTO groups(name,description,created_at) VALUES(?,?,?)", name, description, now()).lastInsertRowid);
        run("INSERT INTO group_admins(group_id,user_id) VALUES(?,?)", groupId, user.id);
        run("INSERT INTO schedules(group_id) VALUES(?)", groupId);
        addCatalogProducts(groupId, body.productKeys || catalog.map(p => p.key));
        audit(groupId, user.id, "group_created");
        return groupId;
      });
      return send(res, { id }, 201);
    }
    const route = path.match(/^\/api\/groups\/(\d+)(?:\/(.*))?$/);
    if (!route) fail(404, "NOT_FOUND");
    const groupId = idOf(route[1]), action = route[2] || "";
    const group = access(user, groupId);
    if (!action && method === "GET") {
      const products = all(`SELECT p.*,a.id AS assignment_id,a.user_id AS owner_id,u.name AS owner_name FROM products p
        LEFT JOIN assignments a ON a.product_id=p.id AND a.ended_at IS NULL LEFT JOIN users u ON u.id=a.user_id
        WHERE p.group_id=? ORDER BY p.active DESC,p.category,p.id`, groupId);
      const own = get(`SELECT a.*,p.name_uz,p.name_en,p.name_ru,p.category,p.unit FROM assignments a
        JOIN products p ON p.id=a.product_id WHERE a.group_id=? AND a.user_id=? AND a.ended_at IS NULL`, groupId, user.id) || null;
      const window = currentWindow(groupId);
      if (group.archived) window.open = false;
      let latest = null;
      if (own) latest = get(`SELECT r.*,s.id AS submission_id FROM submissions s JOIN periods p ON p.id=s.period_id
        JOIN price_revisions r ON r.submission_id=s.id WHERE s.assignment_id=? AND p.period_key=? ORDER BY r.version DESC LIMIT 1`, own.id, window.key) || null;
      const visibleOwner = group.isAdmin ? "" : " AND r.user_id=?";
      const ownerArgs = group.isAdmin ? [groupId] : [groupId, user.id];
      const changeRequests = all(`SELECT r.*,u.name AS member_name,p.name_uz,p.name_en,p.name_ru
        FROM product_change_requests r JOIN users u ON u.id=r.user_id JOIN products p ON p.id=r.product_id
        WHERE r.group_id=?${group.isAdmin ? " AND r.status='pending'" : visibleOwner} ORDER BY r.id DESC LIMIT 100`, ...ownerArgs);
      const locations = all(`SELECT r.*,u.name AS member_name FROM store_locations r JOIN users u ON u.id=r.user_id
        WHERE r.group_id=? AND r.status IN ('pending','approved','rejected')${visibleOwner} ORDER BY r.id DESC LIMIT 300`, ...ownerArgs);
      const collectedStores = latest ? all(`SELECT DISTINCT o.store_key FROM store_observations o JOIN price_revisions r ON r.id=o.revision_id
        WHERE r.submission_id=?`, latest.submission_id).map(row => row.store_key) : [];
      if (latest && !collectedStores.length) collectedStores.push(...storeKeys);
      return send(res, { group, products, assignment: own, latest, window, changeRequests, locations, collectedStores,
        schedule: group.isAdmin ? get("SELECT * FROM schedules WHERE group_id=?", groupId) : null, serverTime: now(), today: localDate(now()) });
    }
    if (action === "archive" && method === "POST") {
      access(user, groupId, true);
      if (typeof body.archived !== "boolean") fail(400, "INVALID_INPUT");
      run("UPDATE groups SET archived=? WHERE id=?", Number(body.archived), groupId);
      audit(groupId, user.id, body.archived ? "group_archived" : "group_restored");
      return send(res, { ok: true });
    }
    if (action === "products" && method === "POST") {
      access(user, groupId, true, true);
      transaction(db, () => {
        if (body.productKeys) addCatalogProducts(groupId, body.productKeys);
        else {
          const uz = text(body.name_uz, 2, 100), en = text(body.name_en || uz, 2, 100), ru = text(body.name_ru || uz, 2, 100);
          if (!["fruit", "vegetable", "grain", "other"].includes(body.category) || !["kg", "l", "piece", "pack"].includes(body.unit)) fail(400, "INVALID_INPUT");
          run("INSERT INTO products(group_id,category,name_uz,name_en,name_ru,unit) VALUES(?,?,?,?,?,?)", groupId, body.category, uz, en, ru, body.unit);
        }
        audit(groupId, user.id, "products_added");
      });
      return send(res, { ok: true }, 201);
    }
    if (/^products\/\d+$/.test(action) && method === "DELETE") {
      access(user, groupId, true, true);
      const productId = idOf(action.split("/")[1]);
      transaction(db, () => {
        if (!get("SELECT id FROM products WHERE id=? AND group_id=?", productId, groupId)) fail(404, "NOT_FOUND");
        if (get("SELECT id FROM assignments WHERE product_id=? AND ended_at IS NULL", productId)) fail(409, "PRODUCT_TAKEN");
        run("UPDATE products SET active=0 WHERE id=?", productId);
        audit(groupId, user.id, "product_archived", { productId });
      });
      return send(res, { ok: true });
    }
    if (action === "assign" && method === "POST") {
      access(user, groupId, false, true);
      if (user.role !== "student") fail(403, "STUDENT_ONLY");
      const productId = idOf(body.productId);
      const result = transaction(db, () => {
        const product = get("SELECT * FROM products WHERE id=? AND group_id=? AND active=1", productId, groupId);
        if (!product) fail(404, "NOT_FOUND");
        const current = get("SELECT * FROM assignments WHERE group_id=? AND user_id=? AND ended_at IS NULL", groupId, user.id);
        if (current?.product_id === productId) return current.id;
        if (get("SELECT id FROM assignments WHERE product_id=? AND ended_at IS NULL", productId)) fail(409, "PRODUCT_TAKEN");
        let reason = null, note = "";
        if (current) {
          if (!["unavailable", "discontinued", "seasonal", "other"].includes(body.reason)) fail(400, "CHANGE_REASON_REQUIRED");
          reason = body.reason;
          note = text(body.reasonNote ?? "", 0, 500);
          if (reason === "other" && note.length < 5) fail(400, "CHANGE_NOTE_REQUIRED");
          run("UPDATE product_change_requests SET status='cancelled',reviewed_at=? WHERE group_id=? AND user_id=? AND status='pending'", now(), groupId, user.id);
          const requestId = Number(run(`INSERT INTO product_change_requests(group_id,user_id,assignment_id,product_id,reason,note,requested_at)
            VALUES(?,?,?,?,?,?,?)`, groupId, user.id, current.id, productId, reason, note, now()).lastInsertRowid);
          audit(groupId, user.id, "product_change_requested", { requestId, from: current.product_id, to: productId, reason, note });
          return { requestId, pending: true, id: current.id };
        }
        const id = Number(run("INSERT INTO assignments(group_id,user_id,product_id,started_at) VALUES(?,?,?,?)", groupId, user.id, productId, now()).lastInsertRowid);
        audit(groupId, user.id, current ? "product_changed" : "product_selected",
          { from: current?.product_id || null, to: productId, ...(current ? { reason, note } : {}) });
        return id;
      });
      return send(res, typeof result === "number" ? { id: result } : result);
    }
    if (/^changes\/\d+\/(approve|reject|cancel)$/.test(action) && method === "POST") {
      const [, requestId, decision] = action.split("/");
      access(user, groupId, decision !== "cancel", true);
      const result = transaction(db, () => {
        const request = get("SELECT * FROM product_change_requests WHERE id=? AND group_id=?", idOf(requestId), groupId);
        if (!request || (decision === "cancel" && request.user_id !== user.id)) fail(404, "NOT_FOUND");
        if (request.status !== "pending") fail(409, "REQUEST_RESOLVED");
        let assignmentId = request.assignment_id;
        if (decision === "approve") {
          const current = get(`SELECT a.* FROM assignments a JOIN memberships m ON m.group_id=a.group_id AND m.user_id=a.user_id
            WHERE a.id=? AND a.group_id=? AND a.user_id=? AND a.ended_at IS NULL AND m.active=1`, request.assignment_id, groupId, request.user_id);
          if (!current) fail(409, "ASSIGNMENT_INVALID");
          if (!get("SELECT id FROM products WHERE id=? AND group_id=? AND active=1", request.product_id, groupId)) fail(409, "NOT_FOUND");
          if (get("SELECT id FROM assignments WHERE product_id=? AND ended_at IS NULL", request.product_id)) fail(409, "PRODUCT_TAKEN");
          run("UPDATE assignments SET ended_at=?,end_reason=?,end_note=? WHERE id=?", now(), request.reason, request.note, current.id);
          assignmentId = Number(run("INSERT INTO assignments(group_id,user_id,product_id,started_at) VALUES(?,?,?,?)", groupId, request.user_id, request.product_id, now()).lastInsertRowid);
          audit(groupId, user.id, "product_changed", { from: current.product_id, to: request.product_id, reason: request.reason, note: request.note });
        }
        const status = { approve: "approved", reject: "rejected", cancel: "cancelled" }[decision];
        run("UPDATE product_change_requests SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?", status, now(), user.id, request.id);
        audit(groupId, user.id, "product_change_" + status, { requestId: request.id, userId: request.user_id });
        return { id: assignmentId, status };
      });
      return send(res, result);
    }
    if (action === "locations" && method === "POST") {
      access(user, groupId, false, true);
      if (user.role !== "student") fail(403, "STUDENT_ONLY");
      if (!storeKeys.includes(body.storeKey) || !coordinates(body)) fail(400, "INVALID_INPUT");
      const name = text(body.name, 2, 100);
      const brand = body.storeKey === "secondary" ? body.brand : body.storeKey === "korzinka" ? "Korzinka" : "local";
      if (body.storeKey === "secondary" && !["Havas", "Mall"].includes(brand)) fail(400, "INVALID_INPUT");
      const id = transaction(db, () => {
        run("UPDATE store_locations SET status='superseded' WHERE group_id=? AND user_id=? AND store_key=? AND status='pending'", groupId, user.id, body.storeKey);
        return Number(run(`INSERT INTO store_locations(group_id,user_id,store_key,name,brand,latitude,longitude,requested_at)
          VALUES(?,?,?,?,?,?,?,?)`, groupId, user.id, body.storeKey, name, brand, body.latitude, body.longitude, now()).lastInsertRowid);
      });
      audit(groupId, user.id, "location_requested", { locationId: id });
      return send(res, { id, status: "pending" }, 201);
    }
    if (/^locations\/\d+\/(approve|reject)$/.test(action) && method === "POST") {
      access(user, groupId, true, true);
      const [, locationId, decision] = action.split("/");
      transaction(db, () => {
        const place = get(`SELECT r.* FROM store_locations r JOIN memberships m ON m.group_id=r.group_id AND m.user_id=r.user_id
          WHERE r.id=? AND r.group_id=? AND m.active=1`, idOf(locationId), groupId);
        if (!place) fail(404, "NOT_FOUND");
        if (place.status !== "pending") fail(409, "REQUEST_RESOLVED");
        if (decision === "approve") run("UPDATE store_locations SET status='superseded' WHERE group_id=? AND user_id=? AND store_key=? AND status='approved'", groupId, place.user_id, place.store_key);
        run("UPDATE store_locations SET status=?,reviewed_at=?,reviewed_by=? WHERE id=?", decision === "approve" ? "approved" : "rejected", now(), user.id, place.id);
        audit(groupId, user.id, "location_" + (decision === "approve" ? "approved" : "rejected"), { locationId: place.id, userId: place.user_id });
      });
      return send(res, { ok: true });
    }
    if (action === "schedule" && method === "POST") {
      access(user, groupId, true, true);
      const previous = get("SELECT * FROM schedules WHERE group_id=?", groupId);
      if (!["manual", "single", "weekly"].includes(body.mode)) fail(400, "INVALID_INPUT");
      transaction(db, () => {
        const previousWindow = currentWindow(groupId);
        const unchangedManual = previous.mode === "manual" && body.mode === "manual" && Boolean(previous.manual_open) === body.open;
        if (previousWindow.open && !unchangedManual) {
          run("UPDATE periods SET end_at=? WHERE group_id=? AND period_key=?", now(), groupId, previousWindow.key);
        }
        if (body.mode === "manual") {
          if (typeof body.open !== "boolean") fail(400, "INVALID_INPUT");
          const newPeriod = body.open && (previous.mode !== "manual" || !previous.manual_open);
          run(`UPDATE schedules SET mode='manual',manual_open=?,manual_start=?,revision=? WHERE group_id=?`,
            Number(body.open), newPeriod ? now() : previous.manual_start,
            previous.revision + (newPeriod ? 1 : 0), groupId);
        } else if (body.mode === "single") {
          const start = iso(body.start), end = iso(body.end);
          if (end <= start) fail(400, "SCHEDULE_INVALID");
          run("UPDATE schedules SET mode='single',start_at=?,end_at=?,manual_open=0,revision=revision+1 WHERE group_id=?", start, end, groupId);
        } else {
          const weekday = integer(body.weekday, 0, 6), minute = integer(body.minute, 0, 1439);
          const duration = integer(body.durationMinutes, 1, 10080);
          run("UPDATE schedules SET mode='weekly',weekday=?,minute=?,duration_minutes=?,manual_open=0,revision=revision+1 WHERE group_id=?", weekday, minute, duration, groupId);
        }
        audit(groupId, user.id, "schedule_changed", { mode: body.mode, open: body.open ?? null });
      });
      return send(res, { window: currentWindow(groupId) });
    }
    if (action === "invites" && method === "GET") {
      access(user, groupId, true);
      return send(res, { invites: all("SELECT id,created_at,expires_at,max_uses,uses,revoked_at FROM invites WHERE group_id=? ORDER BY id DESC", groupId) });
    }
    if (action === "invites" && method === "POST") {
      access(user, groupId, true, true);
      const expires = body.expiresAt ? iso(body.expiresAt) : null;
      if (expires && expires <= now()) fail(400, "INVALID_INPUT");
      const max = body.maxUses == null ? null : integer(body.maxUses, 1, 10000);
      const token = randomToken();
      const id = Number(run("INSERT INTO invites(group_id,token_hash,created_by,created_at,expires_at,max_uses) VALUES(?,?,?,?,?,?)",
        groupId, hash(token), user.id, now(), expires, max).lastInsertRowid);
      audit(groupId, user.id, "invite_created", { inviteId: id });
      return send(res, { id, token }, 201);
    }
    if (/^invites\/\d+$/.test(action) && method === "DELETE") {
      access(user, groupId, true);
      const inviteId = idOf(action.split("/")[1]);
      if (!run("UPDATE invites SET revoked_at=? WHERE id=? AND group_id=?", now(), inviteId, groupId).changes) fail(404, "NOT_FOUND");
      audit(groupId, user.id, "invite_revoked", { inviteId });
      return send(res, { ok: true });
    }
    if (action === "members" && method === "GET") {
      access(user, groupId, true);
      const window = currentWindow(groupId);
      const members = all(`SELECT u.id,u.name,u.username,m.joined_at,m.active,a.product_id,a.id AS assignment_id,
        p.name_uz,p.name_en,p.name_ru,p.category FROM memberships m JOIN users u ON u.id=m.user_id
        LEFT JOIN assignments a ON a.group_id=m.group_id AND a.user_id=m.user_id AND a.ended_at IS NULL
        LEFT JOIN products p ON p.id=a.product_id WHERE m.group_id=? ORDER BY m.active DESC,u.name`, groupId);
      for (const member of members) member.submitted = Boolean(get(`SELECT s.id FROM submissions s JOIN assignments a ON a.id=s.assignment_id
        JOIN periods p ON p.id=s.period_id WHERE s.group_id=? AND a.user_id=? AND p.period_key=? AND ((SELECT COUNT(DISTINCT o.store_key) FROM store_observations o JOIN price_revisions r ON r.id=o.revision_id WHERE r.submission_id=s.id)=3 OR NOT EXISTS(SELECT 1 FROM store_observations o JOIN price_revisions r ON r.id=o.revision_id WHERE r.submission_id=s.id)) LIMIT 1`, groupId, member.id, window.key));
      for (const member of members) {
        const submission = get(`SELECT s.id FROM submissions s JOIN assignments a ON a.id=s.assignment_id
          JOIN periods p ON p.id=s.period_id WHERE s.group_id=? AND a.user_id=? AND p.period_key=? ORDER BY s.id DESC LIMIT 1`, groupId, member.id, window.key);
        member.collectedStores = member.submitted ? [...storeKeys] : submission ? all(`SELECT DISTINCT o.store_key FROM store_observations o
          JOIN price_revisions r ON r.id=o.revision_id WHERE r.submission_id=?`, submission.id).map(row => row.store_key) : [];
      }
      return send(res, { members });
    }
    if (/^members\/\d+\/remove$/.test(action) && method === "POST") {
      access(user, groupId, true, true);
      const memberId = idOf(action.split("/")[1]);
      transaction(db, () => {
        if (!run("UPDATE memberships SET active=0 WHERE group_id=? AND user_id=? AND active=1", groupId, memberId).changes) fail(404, "NOT_FOUND");
        run("UPDATE assignments SET ended_at=?,end_reason='member_removed' WHERE group_id=? AND user_id=? AND ended_at IS NULL", now(), groupId, memberId);
        audit(groupId, user.id, "member_removed", { memberId });
      });
      return send(res, { ok: true });
    }
    if (/^members\/\d+\/password$/.test(action) && method === "POST") {
      access(user, groupId, true);
      const memberId = idOf(action.split("/")[1]);
      if (!get("SELECT 1 FROM memberships m JOIN users u ON u.id=m.user_id WHERE m.group_id=? AND m.user_id=? AND m.active=1 AND u.role='student'", groupId, memberId)) fail(404, "NOT_FOUND");
      if (typeof body.password !== "string" || body.password.length < 10 || body.password.length > 128) fail(400, "PASSWORD_LENGTH");
      const pass = await passwordHash(body.password);
      transaction(db, () => {
        run("UPDATE users SET password_hash=? WHERE id=?", pass, memberId);
        run("DELETE FROM sessions WHERE user_id=?", memberId);
        audit(groupId, user.id, "password_reset", { memberId });
      });
      return send(res, { ok: true });
    }
    if (action === "assignments" && method === "GET") {
      const rows = all(`SELECT a.*,u.name AS member_name,p.name_uz,p.name_en,p.name_ru,p.category,p.unit
        FROM assignments a JOIN users u ON u.id=a.user_id JOIN products p ON p.id=a.product_id
        WHERE a.group_id=? ${group.isAdmin ? "" : "AND a.user_id=?"} ORDER BY a.id DESC`,
        ...group.isAdmin ? [groupId] : [groupId, user.id]);
      return send(res, { assignments: rows });
    }
    if (action === "submissions" && method === "POST") {
      access(user, groupId, false, true);
      const window = currentWindow(groupId);
      if (!window.open) fail(409, "WINDOW_CLOSED");
      const assignment = get("SELECT * FROM assignments WHERE id=? AND user_id=? AND group_id=? AND ended_at IS NULL", idOf(body.assignmentId), user.id, groupId);
      if (!assignment) fail(409, "ASSIGNMENT_INVALID");
      if (typeof body.observedOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.observedOn) ||
        !Number.isFinite(Date.parse(body.observedOn)) || new Date(body.observedOn).toISOString().slice(0, 10) !== body.observedOn ||
        body.observedOn > localDate(now()) || body.observedOn < localDate(assignment.started_at)) fail(400, "DATE_INVALID");
      const price = val => {
        if (val === null) return null;
        if (typeof val !== "number" || !Number.isFinite(val) || val <= 0 || val > 100000000 || Math.abs(val * 100 - Math.round(val * 100)) > 0.00001) fail(400, "PRICE_INVALID");
        return Math.round(val * 100);
      };
      const keys = body.storeKey === undefined ? storeKeys : [body.storeKey];
      if (keys.some(key => !storeKeys.includes(key))) fail(400, "INVALID_INPUT");
      const places = keys.map(key => {
        const place = get("SELECT * FROM store_locations WHERE group_id=? AND user_id=? AND store_key=? AND status='approved'", groupId, user.id, key);
        if (!place) fail(409, "LOCATION_REQUIRED");
        const error = locationError(body.location, place, now());
        if (error) fail(403, error);
        return place;
      });
      const result = transaction(db, () => {
        const previous = get(`SELECT r.* FROM price_revisions r JOIN submissions s ON s.id=r.submission_id JOIN periods p ON p.id=s.period_id
          WHERE s.assignment_id=? AND p.period_key=? ORDER BY r.version DESC LIMIT 1`, assignment.id, window.key);
        const values = { korzinka: previous?.korzinka ?? null, secondary: previous?.secondary ?? null, local: previous?.local ?? null };
        let secondaryStore = previous?.secondary_store || "Havas", store = previous?.local_store || "—";
        for (const place of places) {
          values[place.store_key] = price(body[place.store_key]);
          if (place.store_key === "secondary") secondaryStore = place.brand;
          if (place.store_key === "local") store = place.name;
        }
        const { korzinka, secondary, local } = values;
        run("INSERT OR IGNORE INTO periods(group_id,period_key,start_at,end_at) VALUES(?,?,?,?)", groupId, window.key, window.start, window.end);
        const periodId = get("SELECT id FROM periods WHERE group_id=? AND period_key=?", groupId, window.key).id;
        run("INSERT OR IGNORE INTO submissions(group_id,assignment_id,period_id,created_at) VALUES(?,?,?,?)", groupId, assignment.id, periodId, now());
        const submission = get("SELECT id FROM submissions WHERE assignment_id=? AND period_id=?", assignment.id, periodId);
        const version = get("SELECT COALESCE(MAX(version),0)+1 AS n FROM price_revisions WHERE submission_id=?", submission.id).n;
        const revisionId = Number(run(`INSERT INTO price_revisions(submission_id,version,observed_on,korzinka,secondary_store,secondary,local_store,local,created_at)
          VALUES(?,?,?,?,?,?,?,?,?)`, submission.id, version, body.observedOn, korzinka, secondaryStore, secondary, store, local, now()).lastInsertRowid);
        for (const place of places) run(`INSERT INTO store_observations(revision_id,location_id,store_key,latitude,longitude,accuracy,measured_at,distance)
          VALUES(?,?,?,?,?,?,?,?)`, revisionId, place.id, place.store_key, body.location.latitude, body.location.longitude,
          body.location.accuracy, new Date(body.location.timestamp).toISOString(), distanceMeters(body.location, place));
        audit(groupId, user.id, version === 1 ? "prices_submitted" : "prices_corrected", { submissionId: submission.id, version });
        return { id: submission.id, version };
      });
      return send(res, result, 201);
    }
    if (action === "history" && method === "GET") return send(res, history(user, groupId, url.searchParams));
    if (action === "export" && method === "GET") {
      const { records } = history(user, groupId, url.searchParams, true);
      const quote = value => {
        let str = String(value ?? "");
        if (/^[=+\-@\t\r]/.test(str)) str = "'" + str;
        return `"${str.replaceAll('"', '""')}"`;
      };
      const rows = [["Member", "Username", "Product (UZ)", "Category", "Unit", "Assignment ID", "Period start (UTC)", "Observed date", "Revision", "Korzinka (UZS)", "Second store", "Second price (UZS)", "Local store", "Local price (UZS)", "Saved at (UTC)", "Assignment end reason", "Assignment end note"]];
      for (const record of records) for (const r of [...record.revisions].reverse()) rows.push([
        record.member_name, record.username, record.name_uz, record.category, record.unit, record.assignment_id, record.period_start,
        r.observed_on, r.version, r.korzinka === null ? "" : r.korzinka / 100, r.secondary_store,
        r.secondary === null ? "" : r.secondary / 100, r.local_store, r.local === null ? "" : r.local / 100, r.created_at, record.end_reason, record.end_note
      ]);
      res.writeHead(200, { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="elastic-group-${groupId}.csv"` });
      return res.end("\ufeff" + rows.map(row => row.map(quote).join(",")).join("\r\n"));
    }
    if (action === "audit" && method === "GET") {
      access(user, groupId, true);
      return send(res, { events: all(`SELECT e.*,u.name AS actor_name FROM audit_events e JOIN users u ON u.id=e.actor_id
        WHERE e.group_id=? ORDER BY e.id DESC LIMIT 150`, groupId) });
    }
    fail(404, "NOT_FOUND");
  }
  const server = http.createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(self)");
    res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://tile.openstreetmap.org https://maps.geoapify.com; font-src 'self'; connect-src 'self' https://api.geoapify.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    try {
      // Render probes use an internal Host. Expose only a data-free liveness check.
      if (req.url === "/healthz" && ["GET", "HEAD"].includes(req.method)) {
        db.prepare("SELECT 1").get();
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(req.method === "HEAD" ? undefined : '{"status":"ok"}');
      }
      if (origin && req.headers.host !== new URL(origin).host) fail(403, "ORIGIN_INVALID");
      const url = new URL(req.url, origin || "http://localhost");
      if (url.pathname.startsWith("/api/")) return await api(req, res, url);
      if (req.method !== "GET" && req.method !== "HEAD") fail(405, "METHOD_NOT_ALLOWED");
      const files = { "/": "index.html", "/index.html": "index.html", "/app.js": "app.js", "/location.js": "location.js", "/geo.js": "geo.js", "/vendor/leaflet.js": "vendor/leaflet.js", "/vendor/leaflet.css": "vendor/leaflet.css", "/i18n.js": "i18n.js", "/theme.js": "theme.js", "/styles.css": "styles.css", "/favicon.svg": "favicon.svg" };
      const file = files[url.pathname];
      if (!file) fail(404, "NOT_FOUND");
      const data = await readFile(resolve(publicDir, file));
      const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
      res.writeHead(200, { "Content-Type": `${types[extname(file)]}; charset=utf-8` });
      res.end(req.method === "HEAD" ? undefined : data);
    } catch (error) {
      if (res.headersSent) { res.end(); return; }
      if (error instanceof AppError) send(res, { error: error.code }, error.status);
      else if (/UNIQUE constraint failed/.test(error.message)) send(res, { error: "CONFLICT" }, 409);
      else { console.error("Request failed:", error.message); send(res, { error: "SERVER_ERROR" }, 500); }
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return { server, db, setupToken, needsSetup };
}
