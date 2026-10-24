import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp } from "../../lib/app.mjs";
import { passwordHash } from "../../lib/security.mjs";
import { windowFor } from "../../lib/schedule.mjs";
import { catalog } from "../../lib/catalog.mjs";

const PASSWORD = "OnlyForAutomatedTests!27";
export async function fixture(t, { locations = true } = {}) {
  let clock = "2026-10-20T07:00:00.000Z";
  const app = createApp({ now: () => clock, setupToken: "automated-test-setup-token", mapApiKey:"test-map-key-not-a-real-secret" });
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
      return { ...json, requestStatus: json.status, status: response.status };
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
    if (locations) for (const storeKey of ["korzinka", "secondary", "local"]) {
      const place = await client.ok(`/groups/${groupId}/locations`, "POST", { storeKey, name: "Test shop", brand: "Havas", latitude: 41.3111, longitude: 69.2797 });
      await admin.ok(`/groups/${groupId}/locations/${place.id}/approve`, "POST", {});
    }
    return client;
  }
  const price = assignmentId => ({ assignmentId, observedOn: "2026-10-20", korzinka: 15000.5,
    secondaryStore: "Havas", secondary: 14500, localStore: "Chorsu shop", local: 13000, location: { latitude: 41.3111, longitude: 69.2797, accuracy: 5, timestamp: Date.parse(clock) } });
  return { app, origin, Client, admin, group, invite, student, price, setClock: value => { clock = value; } };
}

