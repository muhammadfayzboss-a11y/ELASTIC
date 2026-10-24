import { storeKeys, distanceMeters, locationError, currentFix, toFix, mountMap, configureMaps } from "./location.js";
import { languages, messages } from "./i18n.js";

const app = document.querySelector("#app"), dialog = document.querySelector("#modal");
const state = {
  lang: localStorage.getItem("micro-language") || "uz", user: null, csrf: null,
  groups: [], catalog: [], group: null, history: null, filters: {}, category: "all",
  search: "", availableOnly: true, authMode: null, invite: null, route: "overview",
  request: 0, setupRequired: false, busy: false,
  theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light"
};
if (!languages[state.lang]) state.lang = "uz";
const t = (key, vars = {}) => Object.entries(vars).reduce((value, [k, v]) => value.replaceAll(`{${k}}`, String(v)), messages[state.lang][key] || messages.en[key] || key);
const e = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const locale = () => ({ uz: "uz-UZ", en: "en-GB", ru: "ru-RU" }[state.lang]);
const nameOf = product => product?.[`name_${state.lang}`] || product?.name_uz || "—";
const num = number => new Intl.NumberFormat(locale()).format(number || 0);
const money = value => value === null || value === undefined ? t("unavailable") : new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value / 100);
const date = (value, time = false) => {
  if (!value) return "—";
  if (state.lang === "uz") {
    const local = new Date(Date.parse(value) + 5 * 3600000);
    const months = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
    return `${local.getUTCDate()} ${months[local.getUTCMonth()]} ${local.getUTCFullYear()}${time ? `, ${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}` : ""}`;
  }
  return new Intl.DateTimeFormat(locale(), {
    timeZone: "Asia/Tashkent", day: "numeric", month: "short", year: "numeric",
    ...(time ? { hour: "2-digit", minute: "2-digit" } : {})
  }).format(new Date(value));
};
const localInput = value => value ? new Date(Date.parse(value) + 5 * 3600000).toISOString().slice(0, 16) : "";
const fromLocal = value => value ? new Date(`${value}:00+05:00`).toISOString() : null;
const paths = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3a4 4 0 0 1 0 8"/><circle cx="9" cy="7" r="4"/>',
  box: '<path d="m21 8-9 5-9-5m9 5v9m9-14-9-5-9 5v10l9 5 9-5ZM7.5 5.5l9 5"/>',
  history: '<path d="M3 11a9 9 0 1 1 2.6 7M3 4v7h7m2-4v5l3 2"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m9 3-1 3-3 1-2 4 2 2v3l3 2 1 3h5l1-3 3-1 3-4-2-2V8l-3-2-1-3Z"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="m10 13 4-4m-6 6-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 2 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" transform="translate(1 1)"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
  logout: '<path d="M9 4H4v16h5m1-8h11m-4-4 4 4-4 4"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15m-8 4v7m4-7v7"/>',
  key: '<circle cx="8" cy="9" r="5"/><path d="m12 13 8 8m-4-4 3-3m-6 0 3-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  leaf: '<path d="M20 3C6 2 1 10 6 16s15 0 14-13ZM5 21 16 8"/>',
  copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  chart: '<path d="M3 3v18h18M7 15l4-5 4 3 5-8"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 13.5A9 9 0 0 1 10.5 3.5a9 9 0 1 0 10 10Z"/>'
};
const icon = (name, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.box}</svg>`;
const logo = () => `<span class="brand-mark"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M24 8H9v16h15M9 16h12" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span class="brand-word">ELASTIC<span>${t("tagline")}</span></span>`;
const emoji = p => {
  const map = { "Olma": "🍎", "Nok": "🍐", "Banan": "🍌", "Apelsin": "🍊", "Mandarin": "🍊", "Limon": "🍋", "Uzum": "🍇", "Anor": "🔴", "Shaftoli": "🍑", "O‘rik": "🍑", "Gilos": "🍒", "Olcha": "🍒", "Qulupnay": "🍓", "Tarvuz": "🍉", "Qovun": "🍈", "Kivi": "🥝", "Kartoshka": "🥔", "Piyoz": "🧅", "Sabzi": "🥕", "Pomidor": "🍅", "Bodring": "🥒", "Karam": "🥬", "Sarimsoq": "🧄", "Bulg‘or qalampiri": "🫑", "Achchiq qalampir": "🌶️", "Baqlajon": "🍆", "Qovoq": "🎃", "Brokkoli": "🥦", "Makkajo‘xori": "🌽", "Guruch": "🍚" };
  return map[p?.name_uz] || ({ fruit: "🍐", vegetable: "🥬", grain: "🌾", other: "📦" }[p?.category] || "📦");
};
const languageSelect = () => `<select class="language-select" data-language aria-label="${t("language")}">${Object.entries(languages).map(([k, v]) => `<option value="${k}" ${state.lang === k ? "selected" : ""}>${v}</option>`).join("")}</select>`;
const themeButton = (withLabel = false) => `<button type="button" class="${withLabel ? "btn secondary small" : "icon-btn theme-toggle"}" data-action="theme" data-theme-label="${withLabel}" title="${t(state.theme === "dark" ? "switchLight" : "switchDark")}" aria-label="${t(state.theme === "dark" ? "switchLight" : "switchDark")}">${icon(state.theme === "dark" ? "sun" : "moon")}${withLabel ? `<span>${t(state.theme === "dark" ? "lightMode" : "darkMode")}</span>` : ""}</button>`;
function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#111c18" : "#174f41";
  try { localStorage.setItem("micro-theme", theme); } catch {}
  document.querySelectorAll('[data-action="theme"]').forEach(button => {
    button.title = t(theme === "dark" ? "switchLight" : "switchDark");
    button.setAttribute("aria-label", button.title);
    button.innerHTML = icon(theme === "dark" ? "sun" : "moon") + (button.dataset.themeLabel === "true" ? `<span>${t(theme === "dark" ? "lightMode" : "darkMode")}</span>` : "");
  });
}
const button = (label, action, iconName = "", cls = "primary", attrs = "") => `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${iconName ? icon(iconName) : ""}<span>${label}</span></button>`;
const empty = (title, message, iconName = "box", extra = "") => `<div class="empty"><div class="empty-icon">${icon(iconName)}</div><h3>${title}</h3><p>${message}</p>${extra}</div>`;
const field = (label, input, hint = "") => `<label class="field"><span>${label}</span>${input}${hint ? `<small>${hint}</small>` : ""}</label>`;
const statusBadge = group => `<span class="badge ${group.archived ? "neutral" : group.window?.open ? "green" : "amber"}"><i></i>${group.archived ? t("archived") : group.window?.open ? t("open") : t("closed")}</span>`;
const productBadge = p => `<span class="product-emoji ${e(p.category)}" aria-hidden="true">${emoji(p)}</span>`;
const reasonContent = a => a.end_reason
  ? `<span class="reason-name">${t(`reason_${a.end_reason}`)}</span>${a.end_note ? `<p class="reason-note">${e(a.end_note)}</p>` : ""}`
  : `<span class="muted">${a.ended_at ? t("reasonNotRecorded") : "—"}</span>`;

async function api(path, method = "GET", data) {
  let response;
  try {
    response = await fetch(`/api${path}`, { method, headers: { "Content-Type": "application/json", ...(state.csrf ? { "X-CSRF-Token": state.csrf } : {}) },
      ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  } catch { throw new Error(t("networkError")); }
  const result = await response.json();
  if (!response.ok) {
    if (result.error === "LOGIN_REQUIRED") { state.user = null; state.csrf = null; }
    const error = new Error(t(result.error || "SERVER_ERROR")); error.code = result.error; throw error;
  }
  return result;
}
let toastTimer;
function toast(message, bad = false) {
  const target = document.querySelector("#toast");
  target.textContent = message; target.className = `show${bad ? " bad" : ""}`;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { target.className = ""; }, 5000);
}
function showDialog(title, content, wide = false) {
  dialog.className = wide ? "wide" : "";
  dialog.innerHTML = `<div class="dialog-heading"><h2 id="dialog-title">${title}</h2><button type="button" class="icon-btn" data-action="close-dialog" aria-label="${t("close")}">${icon("close")}</button></div>${content}`;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() { activeMap?.destroy(); activeMap = null; if (dialog.open) dialog.close(); state.confirm = null; }
function confirmDialog(title, explanation, callback) {
  state.confirm = callback;
  showDialog(title, `<p class="dialog-intro">${explanation}</p><div class="dialog-actions">${button(t("cancel"), "close-dialog", "", "secondary")}${button(t("save"), "confirm", "check")}</div>`);
}
function formFooter(label = t("save")) {
  return `<div class="form-error" role="alert"></div><div class="dialog-actions">${button(t("cancel"), "close-dialog", "", "secondary")}<button class="btn primary" type="submit">${icon("check")}${label}</button></div>`;
}
function go(route) {
  closeDialog(); document.body.classList.remove("menu-open");
  if (location.hash === `#${route}`) load(); else location.hash = route;
}
function routeInfo() {
  const raw = location.hash.slice(1);
  if (raw.startsWith("join=")) return { page: "join", token: raw.slice(5) };
  if (raw.startsWith("setup=")) return { page: "setup", token: raw.slice(6) };
  const [page, id, tab] = raw.split("/");
  return { page: ["overview", "groups", "catalog", "settings", "group"].includes(page) ? page : "overview", id: Number(id), tab: tab || "products" };
}
function shell(content, title) {
  document.documentElement.lang = state.lang;
  document.querySelector(".skip-link").textContent = t("skipContent");
  document.title = `${title} · ELASTIC`;
  const route = routeInfo(), admin = state.user.role === "admin";
  app.innerHTML = `<div class="layout"><button class="sidebar-overlay" data-action="menu" aria-label="${t("close")}"></button>
    <aside class="sidebar"><a class="brand" href="#overview">${logo()}</a><div class="sidebar-content">
      <p class="nav-label">${t("workspace")}</p><nav aria-label="${t("workspace")}">
      ${[["overview", "grid"], ["groups", "users"], ["catalog", "box"]].map(([key, ico]) => `<a href="#${key}" class="nav-item ${route.page === key ? "active" : ""}">${icon(ico)}<span>${t(key)}</span>${key === "groups" ? `<b>${state.groups.length}</b>` : ""}</a>`).join("")}</nav>
      <div class="nav-label row"><span>${t("myGroups")}</span>${admin ? `<button class="mini-btn" data-action="new-group" aria-label="${t("newGroup")}">${icon("plus")}</button>` : ""}</div>
      <nav class="group-nav">${state.groups.slice(0, 12).map((g, i) => `<a href="#group/${g.id}/products" class="nav-item group-nav-item ${route.id === g.id ? "active" : ""}"><i class="group-dot dot-${i % 4}"></i><span>${e(g.name)}</span>${g.archived ? icon("lock") : ""}</a>`).join("") || `<p class="sidebar-note">${admin ? t("noGroups") : t("noGroupsStudent")}</p>`}</nav>
      <div class="sidebar-note-box">${icon("lock")}<p>${t("privateGroups")}<small>${t("permanentHistory")}</small></p></div>
    </div><div class="sidebar-bottom"><a class="nav-item ${route.page === "settings" ? "active" : ""}" href="#settings">${icon("settings")}${t("settings")}</a>
      <div class="profile"><span class="avatar">${e(state.user.name.slice(0, 1).toUpperCase())}</span><div><strong>${e(state.user.name)}</strong><small>${t(admin ? "teacher" : "student")}</small></div><button class="icon-btn" data-action="logout" aria-label="${t("logout")}">${icon("logout")}</button></div></div>
    </aside><div class="workspace"><header class="topbar"><div class="topbar-left"><button class="icon-btn mobile-menu" data-action="menu" aria-label="${t("menu")}">${icon("menu")}</button><span class="breadcrumb">ELASTIC <span>/</span> <strong>${e(title)}</strong></span></div><div class="topbar-right"><span class="today">${icon("clock")}${date(new Date().toISOString())}</span>${themeButton()}${languageSelect()}</div></header>
    <main id="main" tabindex="-1">${content}</main><footer class="page-footer"><span>ELASTIC <span>·</span> ${t("tagline")}</span><span class="creator-credit">${t("creator")}</span><span>${t("tzValue")}</span></footer></div></div>`;
}
function groupCard(g, i) {
  return `<a class="group-card" href="#group/${g.id}/products"><div class="row"><div class="group-symbol tone-${i % 4}">${icon("users")}</div>${statusBadge(g)}</div><h3>${e(g.name)}</h3><p class="group-description">${e(g.description || t("groupsHint"))}</p><div class="group-meta"><span>${icon("users")}${g.members} ${t("members").toLowerCase()}</span><span>${icon("box")}${g.products} ${t("products").toLowerCase()}</span></div><div class="group-progress"><div class="row"><span>${t("thisPeriod")}</span><strong>${g.submitted}/${g.members}</strong></div><progress value="${g.submitted}" max="${Math.max(g.members, 1)}" aria-label="${t("groupProgress", { done: g.submitted, total: g.members })}"></progress></div><div class="group-card-footer"><span>${t("availableCount", { count: g.products - g.assigned })}${state.user.role === "admin" && g.pendingRequests ? ` · ${t("requestsTitle")}: ${g.pendingRequests}` : ""}</span>${icon("arrow")}</div></a>`;
}
function renderOverview() {
  const active = state.groups.filter(g => !g.archived);
  const sums = key => active.reduce((sum, g) => sum + g[key], 0);
  const completionRate = sums("members") ? Math.round(100 * sums("submitted") / sums("members")) : 0;
  const admin = state.user.role === "admin";
  const heading = `<div class="page-heading"><div><p class="eyebrow">ELASTIC / ${t("overview")}</p><h1>${t("hello", { name: e(state.user.name.split(" ")[0]) })}<span class="greeting-dot">.</span></h1><p>${t("dashboardIntro")}</p></div>${admin ? button(t("newGroup"), "new-group", "plus") : ""}</div>`;
  const hero = `<section class="hero"><div class="hero-copy"><div class="hero-kicker"><span></span> ELASTIC CLASSROOM</div><h2>${t("heroTitle").replace("\n", "<br>")}</h2><p>${t("heroText")}</p><div class="hero-tags"><span>${icon("box")}${t("threeStores")}</span><span>${icon("history")}${t("permanentHistory")}</span></div></div><div class="hero-art" aria-hidden="true"><div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="art-paper"><div class="art-paper-head"><span class="art-logo">${icon("chart")}</span><span>ELASTIC<span>${t("tagline")}</span></span><i></i></div><div class="art-graph"><svg viewBox="0 0 250 100"><path class="graph-grid" d="M0 20H250M0 50H250M0 80H250"/><path class="graph-area" d="M0 88L42 65 85 73 125 36 165 48 207 18 250 9V100H0Z"/><path class="graph-line" d="M0 88L42 65 85 73 125 36 165 48 207 18 250 9"/></svg></div><div class="art-store"><span>Korzinka</span><i></i><b>● ● ●</b></div><div class="art-store"><span>Havas / Mall</span><i></i><b>● ● ●</b></div></div><div class="art-fruit fruit-one">🍎</div><div class="art-fruit fruit-two">🌾</div><div class="art-check">${icon("check")}</div></div></section>`;
  const stats = `<div class="stats-grid">${[
    ["users", active.length, "activeGroups", "tone-0"], ["users", sums("members"), "members", "tone-1"],
    ["chart", completionRate, "completionRate", "tone-2"], ["check", sums("submitted"), "submitted", "tone-3"]
  ].map(([ico, n, key, tone]) => `<div class="stat-card" ${key === "completionRate" ? `title="${t("completionHint")}"` : ""}><div class="stat-icon ${tone}">${icon(ico)}</div><div><span>${t(key)}</span><strong>${num(n)}${key === "completionRate" ? "%" : ""}</strong></div>${key === "submitted" ? `<small>${t("thisPeriod")}</small>` : ""}</div>`).join("")}</div>`;
  const groups = `<section><div class="section-heading"><div><h2>${t("yourGroups")} <span class="count">${state.groups.length}</span></h2><p>${t("groupsHint")}</p></div><a class="text-link" href="#groups">${t("viewAll")}${icon("arrow")}</a></div>${state.groups.length ? `<div class="group-grid">${state.groups.slice(0, 3).map(groupCard).join("")}</div>` : `<div class="panel">${empty(t("noGroups"), t(admin ? "noGroupsAdmin" : "noGroupsStudent"), "users", admin ? button(t("newGroup"), "new-group", "plus") : "")}</div>`}</section>`;
  const steps = `<section class="steps"><div class="section-heading"><h2>${t("howWorks")}</h2><span class="muted">01 — 03</span></div><div class="steps-grid">${[1, 2, 3].map(n => `<div class="step"><span>0${n}</span><div><h3>${t(`step${n}`)}</h3><p>${t(`step${n}Text`)}</p></div></div>`).join("")}</div></section>`;
  shell(heading + hero + stats + groups + steps, t("overview"));
}
function renderGroups() {
  shell(`<div class="page-heading"><div><p class="eyebrow">ELASTIC / ${t("groups")}</p><h1>${t("yourGroups")}</h1><p>${t("groupsHint")}</p></div>${state.user.role === "admin" ? button(t("newGroup"), "new-group", "plus") : ""}</div><div class="toolbar"><label class="search">${icon("search")}<input id="group-search" placeholder="${t("searchGroups")}" aria-label="${t("searchGroups")}"></label><span class="muted">${state.groups.length} ${t("groups").toLowerCase()}</span></div><div class="group-grid" id="group-list">${state.groups.map(groupCard).join("")}</div>${!state.groups.length ? empty(t("noGroups"), t(state.user.role === "admin" ? "noGroupsAdmin" : "noGroupsStudent"), "users") : ""}`, t("groups"));
}
function categoryTabs() {
  return `<div class="category-tabs" aria-label="${t("category")}">${["all", "fruit", "vegetable", "grain", "other"].map(c => `<button type="button" data-action="category" data-value="${c}" class="${state.category === c ? "active" : ""}">${t(c)}</button>`).join("")}</div>`;
}
function catalogCard(p) {
  return `<article class="product-card catalog-card">${productBadge(p)}<div class="product-card-info"><span class="tiny-label">${t(p.category)}</span><h3>${e(nameOf(p))}</h3><p>${t("perUnit", { unit: t(p.unit) })}</p></div>${icon("leaf", "catalog-leaf")}</article>`;
}
function filteredProducts(products) {
  const search = state.search.toLocaleLowerCase();
  return products.filter(p => (state.category === "all" || p.category === state.category) &&
    [p.name_uz, p.name_en, p.name_ru].some(n => n.toLocaleLowerCase().includes(search)));
}
function renderCatalog() {
  shell(`<div class="page-heading"><div><p class="eyebrow">ELASTIC / ${t("catalog")}</p><h1>${t("catalog")}</h1><p>${t("catalogIntro")}</p></div><span class="catalog-count">50 <small>${t("products")}</small></span></div><div class="panel catalog-panel"><div class="toolbar"><label class="search">${icon("search")}<input id="product-search" value="${e(state.search)}" placeholder="${t("searchProducts")}" aria-label="${t("searchProducts")}"></label><span class="muted">20 / 20 / 10</span></div>${categoryTabs()}<div class="product-grid" id="product-list">${filteredProducts(state.catalog).map(catalogCard).join("")}</div></div>`, t("catalog"));
}
function windowBanner(data) {
  if (data.group.archived) return `<div class="notice">${icon("lock")}<div><strong>${t("archived")}</strong><p>${t("archiveReadonly")}</p></div></div>`;
  const w = data.window;
  return `<div class="window-banner ${w.open ? "is-open" : ""}"><div class="window-icon">${icon(w.open ? "clock" : "lock")}</div><div><strong>${t(w.open ? "windowOpen" : "windowClosed")}</strong><p>${w.open ? w.end ? t("until", { date: date(w.end, true) }) : t("manualUntil") : w.next ? t("nextOpen", { date: date(w.next, true) }) : t("teacherControls")}</p></div><span class="timezone">${t("tzValue")}</span></div>`;
}
function groupProductCard(p) {
  const own = p.owner_id === state.user.id;
  const admin = state.group.group.isAdmin, archived = state.group.group.archived;
  return `<article class="product-card ${own ? "owned" : ""}"><div class="row">${productBadge(p)}<span class="badge ${own ? "green" : p.owner_id ? "neutral" : "outline"}">${t(own ? "mine" : p.owner_id ? "taken" : "available")}</span></div><span class="tiny-label">${t(p.category)}</span><h3>${e(nameOf(p))}</h3><p>${t("perUnit", { unit: t(p.unit) })}</p><div class="product-card-bottom">${p.owner_id ? `<span class="owner"><span class="mini-avatar">${e(p.owner_name.slice(0, 1))}</span>${e(p.owner_name)}</span>` : `<span class="available-label"><i></i>${t("available")}</span>`}
    ${admin && !p.owner_id && !archived ? `<button class="icon-btn" data-action="archive-product" data-id="${p.id}" aria-label="${t("archiveProduct")}">${icon("trash")}</button>` : !admin && !p.owner_id && !archived ? `<button class="btn small secondary" data-action="select-product" data-id="${p.id}">${t("select")}${icon("plus")}</button>` : own && !archived ? `<button class="icon-btn" data-action="prices" aria-label="${t("enterPrices")}" ${!state.group.window.open ? "disabled" : ""}>${icon("arrow")}</button>` : ""}</div></article>`;
}
function productList() {
  let products = state.group.products.filter(p => p.active);
  if (!state.group.group.isAdmin && state.availableOnly) products = products.filter(p => !p.owner_id || p.owner_id === state.user.id);
  products = filteredProducts(products);
  return products.length ? products.map(groupProductCard).join("") : empty(t("noResults"), t("tryFilter"));
}
function groupProducts() {
  const { assignment, group, latest, window } = state.group;
  const own = !group.isAdmin ? assignment ? `<section class="assignment-card"><div class="assignment-info">${productBadge(assignment)}<div><span class="tiny-label">${t("mine")}</span><h2>${e(nameOf(assignment))}</h2><p>${t("perUnit", { unit: t(assignment.unit) })} · ${date(assignment.started_at)}</p>${latest && state.group.collectedStores?.length === 3 ? `<small class="success-text">${icon("check")}${t("periodSubmitted")}</small>` : ""}</div></div><div class="assignment-actions">${button(t(latest ? "editPrices" : "enterPrices"), "prices", "plus", "primary", !window.open || group.archived ? "disabled" : "")}${button(t("changeProduct"), "change-product", "", "text", group.archived ? "disabled" : "")}</div></section>` : `<div class="notice choose-notice">${icon("box")}<div><strong>${t("noAssignment")}</strong><p>${t("noAssignmentText")}</p></div></div>` : "";
  return own + missingPricesPanel() + requestsPanel() + storesPanel() + `<section class="panel catalog-panel"><div class="toolbar"><label class="search">${icon("search")}<input id="product-search" value="${e(state.search)}" placeholder="${t("searchProducts")}" aria-label="${t("searchProducts")}"></label>${group.isAdmin ? button(t("addProduct"), "add-product", "plus", "secondary", group.archived ? "disabled" : "") : `<label class="checkbox"><input type="checkbox" id="available-only" ${state.availableOnly ? "checked" : ""}>${t("showAvailable")}</label>`}</div>${categoryTabs()}<div class="product-grid" id="product-list">${productList()}</div></section>`;
}
function missingPricesPanel() {
  if (!state.group.group.isAdmin) return "";
  const pending = (state.members || []).filter(m => m.active && !m.submitted);
  return `<section class="panel request-panel"><div class="panel-heading"><h2>${t("missingPrices")} <span class="count">${pending.length}</span></h2><span class="muted">${t("thisPeriod")}</span></div><p class="gps-help">${t("missingPricesHint")}</p>${pending.length ? `<div class="table-wrap"><table><thead><tr><th>${t("member")}</th><th>${t("product")}</th><th>${t("missingStores")}</th></tr></thead><tbody>${pending.map(m => `<tr><td><strong>${e(m.name)}</strong><div class="muted">@${e(m.username)}</div></td><td>${m.product_id ? e(nameOf(m)) : `<span class="muted">${t("noProduct")}</span>`}</td><td>${[ ["korzinka", "Korzinka"], ["secondary", "Havas / Mall"], ["local", t("localShop")] ].filter(([key]) => !m.collectedStores?.includes(key)).map(([, label]) => `<span class="badge amber">${e(label)}</span>`).join(" ")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="gps-help">${t((state.members || []).some(m => m.active) ? "allPricesSubmitted" : "noMembers")}</p>`}</section>`;
}
function membersView() {
  const members = state.members || [];
  if (!members.length) return `<div class="panel">${empty(t("noMembers"), t("inviteHint"), "users", button(t("newInvite"), "new-invite", "link"))}</div>`;
  return `<div class="panel"><div class="panel-heading"><h2>${t("members")} <span class="count">${members.filter(m => m.active).length}</span></h2>${button(t("newInvite"), "new-invite", "link", "secondary", state.group.group.archived ? "disabled" : "")}</div><div class="table-wrap"><table><thead><tr><th>${t("member")}</th><th>${t("product")}</th><th>${t("thisPeriod")}</th><th>${t("joined")}</th><th></th></tr></thead><tbody>${members.map(m => `<tr><td><div class="member-cell"><span class="avatar small">${e(m.name.slice(0, 1))}</span><div><strong>${e(m.name)}</strong><small>@${e(m.username)}</small></div></div></td><td>${m.product_id ? e(nameOf(m)) : `<span class="muted">${t("noProduct")}</span>`}</td><td><span class="badge ${!m.active ? "neutral" : m.submitted ? "green" : "amber"}">${t(!m.active ? "removed" : m.submitted ? "submitted" : "notSubmitted")}</span></td><td class="nowrap muted">${date(m.joined_at)}</td><td><div class="table-actions"><button class="icon-btn" data-action="member-history" data-id="${m.id}" title="${t("history")}" aria-label="${t("history")}">${icon("history")}</button>${m.active ? `<button class="icon-btn" data-action="reset-password" data-id="${m.id}" title="${t("resetPassword")}" aria-label="${t("resetPassword")}">${icon("key")}</button><button class="icon-btn danger-text" data-action="remove-member" data-id="${m.id}" title="${t("removeMember")}" aria-label="${t("removeMember")}" ${state.group.group.archived ? "disabled" : ""}>${icon("trash")}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div></div>`;
}
function historyView() {
  const data = state.history, f = state.filters, admin = state.group.group.isAdmin;
  const filters = `<form data-form="history" class="history-filters">${admin ? field(t("member"), `<select name="member"><option value="">${t("allMembers")}</option>${(state.members || []).map(m => `<option value="${m.id}" ${Number(f.member) === m.id ? "selected" : ""}>${e(m.name)}</option>`).join("")}</select>`) : ""}
    ${field(t("product"), `<select name="product"><option value="">${t("allProducts")}</option>${state.group.products.map(p => `<option value="${p.id}" ${Number(f.product) === p.id ? "selected" : ""}>${e(nameOf(p))} · ${t(p.category)}</option>`).join("")}</select>`)}
    ${field(t("from"), `<input type="date" name="from" value="${e(f.from || "")}">`)}${field(t("to"), `<input type="date" name="to" value="${e(f.to || "")}">`)}
    <button class="btn secondary" type="submit">${icon("search")}${t("filter")}</button></form>`;
  const rows = data.records.length ? `<div class="table-wrap"><table><thead><tr>${admin ? `<th>${t("member")}</th>` : ""}<th>${t("product")}</th><th>${t("date")}</th><th>Korzinka</th><th>Havas / Mall</th><th>${t("localShop")}</th><th></th></tr></thead><tbody>${data.records.map(r => `<tr>${admin ? `<td><strong>${e(r.member_name)}</strong></td>` : ""}<td><div class="table-product">${productBadge(r)}<div><strong>${e(nameOf(r))}</strong><small>${t("perUnit", { unit: t(r.unit) })}</small></div></div></td><td class="nowrap">${date(r.observed_on)}<small>${t("revision", { count: r.version })}</small></td><td class="price-cell">${money(r.korzinka)}</td><td class="price-cell">${money(r.secondary)}<small>${e(r.secondary_store)}</small></td><td class="price-cell">${money(r.local)}<small>${e(r.local_store)}</small></td><td><button class="icon-btn" data-action="record" data-id="${r.id}" aria-label="${t("details")}">${icon("chevron")}</button></td></tr>`).join("")}</tbody></table></div><div class="pagination"><span>${t("pageInfo", data)}</span><div>${button(t("previous"), "page-prev", "", "secondary small", data.page <= 1 ? "disabled" : "")}${button(t("next"), "page-next", "", "secondary small", data.page >= data.pages ? "disabled" : "")}</div></div>` : empty(t("noHistory"), t("noHistoryText"), "history");
  let assignments = (state.assignments || []).filter(a => (!f.member || a.user_id === Number(f.member)) && (!f.product || a.product_id === Number(f.product)));
  return `<div class="panel"><div class="panel-heading"><h2>${t("history")}</h2><a class="btn secondary small" href="/api/groups/${state.group.group.id}/export?${new URLSearchParams(f)}" download>${icon("download")}${t("export")}</a></div>${filters}${rows}</div><details class="panel assignment-history"><summary>${icon("history")}${t("assignmentHistory")} <span class="count">${assignments.length}</span></summary><div class="table-wrap"><table><thead><tr><th>${t("member")}</th><th>${t("product")}</th><th>${t("assignmentPeriod")}</th><th>${t("changeReason")}</th></tr></thead><tbody>${assignments.map(a => `<tr><td>${e(a.member_name)}</td><td>${e(nameOf(a))}</td><td>${date(a.started_at, true)} → ${a.ended_at ? date(a.ended_at, true) : t("ongoing")}</td><td class="reason-cell">${reasonContent(a)}</td></tr>`).join("")}</tbody></table></div></details>`;
}
function scheduleView() {
  const s = state.group.schedule;
  return `<div class="two-column"><section class="panel"><div class="panel-heading"><h2>${t("schedule")}</h2>${icon("clock")}</div><form data-form="schedule" class="padded-form"><p class="form-intro">${t("scheduleIntro")}</p><div class="mode-options">${["manual", "single", "weekly"].map(m => `<label><input type="radio" name="mode" value="${m}" ${s.mode === m ? "checked" : ""}>${t(m)}</label>`).join("")}</div>
    <fieldset data-mode="manual" ${s.mode !== "manual" ? "hidden disabled" : ""}><p class="form-intro">${t("manualHint")}</p><label class="switch-line"><input type="checkbox" name="open" ${s.manual_open ? "checked" : ""}><span>${t("windowOpen")}</span></label></fieldset>
    <fieldset data-mode="single" ${s.mode !== "single" ? "hidden disabled" : ""}><div class="form-grid">${field(t("startsAt"), `<input type="datetime-local" name="start" value="${localInput(s.start_at)}" required>`)}${field(t("endsAt"), `<input type="datetime-local" name="end" value="${localInput(s.end_at)}" required>`)}</div></fieldset>
    <fieldset data-mode="weekly" ${s.mode !== "weekly" ? "hidden disabled" : ""}><p class="form-intro">${t("weeklyHint")}</p><div class="form-grid">${field(t("weekday"), `<select name="weekday">${[1, 2, 3, 4, 5, 6, 0].map(d => `<option value="${d}" ${s.weekday === d ? "selected" : ""}>${t(`day${d}`)}</option>`).join("")}</select>`)}${field(t("startsAt"), `<input type="time" name="time" value="${String(Math.floor(s.minute / 60)).padStart(2, "0")}:${String(s.minute % 60).padStart(2, "0")}" required>`)}${field(t("duration"), `<input type="number" name="duration" min="1" max="168" step="1" value="${s.duration_minutes / 60}" required>`)}</div></fieldset>
    <p class="inline-note">${icon("info")}${t("scheduleWarning")}</p><div class="form-error" role="alert"></div><button class="btn primary" type="submit" ${state.group.group.archived ? "disabled" : ""}>${icon("check")}${t("save")}</button></form></section><section class="panel schedule-aside"><div class="large-icon">${icon("clock")}</div><h3>${t("tzValue")}</h3><p>${t("scheduleIntro")}</p><hr><h3>${t("permanentHistory")}</h3><p>${t("revisionHint")}</p></section></div>`;
}
function inviteView() {
  const invites = state.invites || [];
  return `<div class="panel"><div class="panel-heading"><h2>${t("invites")}</h2>${button(t("newInvite"), "new-invite", "plus", "primary", state.group.group.archived ? "disabled" : "")}</div><div class="invite-note">${icon("lock")}<p>${t("invitePrivacy")}</p></div>${invites.length ? `<div class="table-wrap"><table><thead><tr><th>${t("invites")}</th><th>${t("date")}</th><th>${t("expiresAt")}</th><th>${t("used")}</th><th></th></tr></thead><tbody>${invites.map(i => {
    const expired = i.expires_at && i.expires_at <= state.group.serverTime, full = i.max_uses !== null && i.uses >= i.max_uses;
    return `<tr><td><div class="table-product"><span class="stat-icon tone-0">${icon("link")}</span><div><strong>#${i.id}</strong><span class="badge ${i.revoked_at || expired || full ? "neutral" : "green"}">${t(i.revoked_at ? "revoked" : expired ? "expired" : full ? "used" : "active")}</span></div></div></td><td>${date(i.created_at, true)}</td><td>${i.expires_at ? date(i.expires_at, true) : t("unlimited")}</td><td>${i.uses} / ${i.max_uses ?? "∞"}</td><td>${!i.revoked_at ? button(t("revoke"), "revoke-invite", "", "secondary small", `data-id="${i.id}"`) : ""}</td></tr>`;
  }).join("")}</tbody></table></div>` : empty(t("noInvites"), t("inviteHint"), "link")}</div>`;
}
function auditView() {
  return `<div class="panel"><div class="panel-heading"><h2>${t("audit")}</h2><span class="muted">${state.events.length}</span></div><div class="audit-list">${state.events.map(event => {
    let details = {}; try { details = JSON.parse(event.details); } catch {}
    return `<div class="audit-item"><span class="audit-icon">${icon(event.action.startsWith("price") ? "chart" : "history")}</span><div><strong>${t(event.action)}</strong><p>${e(event.actor_name)}</p>${event.action === "product_changed" && details.reason ? `<div class="audit-reason">${reasonContent({ end_reason: details.reason, end_note: details.note })}</div>` : ""}</div><time>${date(event.created_at, true)}</time></div>`;
  }).join("") || empty(t("noActivity"), "", "history")}</div></div>`;
}
function renderGroup() {
  const { group } = state.group, route = routeInfo();
  const tabs = group.isAdmin ? [["products", "box"], ["members", "users"], ["history", "history"], ["schedule", "clock"], ["invites", "link"], ["audit", "grid"]] : [["products", "box"], ["history", "history"]];
  const tab = tabs.some(([key]) => key === route.tab) ? route.tab : "products";
  const content = ({ products: groupProducts, members: membersView, history: historyView, schedule: scheduleView, invites: inviteView, audit: auditView })[tab]();
  shell(`<a href="#groups" class="back-link">← ${t("groups")}</a><div class="page-heading group-heading"><div><div class="eyebrow">${t("groups")} / #${group.id}</div><h1>${e(group.name)}</h1><p>${e(group.description || t("groupsHint"))}</p></div>${group.isAdmin ? button(t(group.archived ? "groupRestore" : "groupArchive"), "archive-group", group.archived ? "history" : "lock", "secondary small") : ""}</div>${windowBanner(state.group)}<nav class="group-tabs">${tabs.map(([key, ico]) => `<a href="#group/${group.id}/${key}" class="${tab === key ? "active" : ""}">${icon(ico)}${t(key)}</a>`).join("")}</nav>${content}`, group.name);
}
function renderSettings() {
  shell(`<div class="page-heading"><div><p class="eyebrow">ELASTIC / ${t("settings")}</p><h1>${t("settings")}</h1><p>${t("account")} · @${e(state.user.username)}</p></div></div><div class="two-column"><div class="panel"><div class="panel-heading"><h2>${t("changePassword")}</h2>${icon("lock")}</div><form class="padded-form" data-form="password">${field(t("currentPassword"), `<input type="password" name="current" required maxlength="128" autocomplete="current-password">`)}${field(t("newPassword"), `<input type="password" name="password" required minlength="10" maxlength="128" autocomplete="new-password">`, t("passwordHint"))}<div class="form-error" role="alert"></div><button class="btn primary" type="submit">${t("save")}</button></form></div><div class="panel padded-form"><h2>${t("account")}</h2><div class="setting-row"><span>${t("fullName")}</span><strong>${e(state.user.name)}</strong></div><div class="setting-row"><span>${t("username")}</span><strong>@${e(state.user.username)}</strong></div><div class="setting-row"><span>${t("language")}</span>${languageSelect()}</div><div class="setting-row"><span>${t("appearance")}</span>${themeButton(true)}</div><div class="setting-row"><span>${t("timezone")}</span><strong>${t("tzValue")}</strong></div></div></div>`, t("settings"));
}
function authLayout(content) {
  document.documentElement.lang = state.lang;
  document.querySelector(".skip-link").textContent = t("skipContent");
  app.innerHTML = `<div class="auth-layout"><section class="auth-story"><a href="#overview" class="brand">${logo()}</a><div class="auth-story-body"><div class="hero-kicker"><span></span> ELASTIC CLASSROOM</div><h1>${t("heroTitle").replace("\n", "<br>")}</h1><p>${t("heroText")}</p><div class="auth-visual" aria-hidden="true"><div class="auth-product">🍎</div><div class="auth-product">🥦</div><div class="auth-product">🌾</div><span class="auth-visual-line"></span></div><div class="auth-features">${["privateGroups", "threeStores", "permanentHistory"].map((key, i) => `<span>${icon(["lock", "box", "history"][i])}${t(key)}</span>`).join("")}</div></div><p class="auth-story-footer">ELASTIC · ${t("tagline")}</p></section><div class="auth-main"><div class="auth-top">${themeButton()}${languageSelect()}</div><main id="main" class="auth-form-area">${content}</main><p class="auth-footer">${icon("lock")}${t("setupSecure")}</p><p class="auth-credit">${t("creator")}</p></div></div>`;
}
function renderAuth(route, invite = null, error = "") {
  const setup = state.setupRequired, setupAllowed = setup && route.page === "setup" && route.token;
  if (error) return authLayout(`<div class="auth-heading"><span class="auth-icon">${icon("link")}</span><h1>${t("errorTitle")}</h1><p>${e(error)}</p></div>${button(t("backLogin"), "back-login", "arrow")}`);
  if (state.user && invite && state.authMode !== "login") return authLayout(`<div class="auth-heading"><span class="auth-icon">${icon("users")}</span><h1>${t("joinTitle")}</h1><p>${t("joinAs", { name: e(invite.name) })}</p></div><div class="invite-group-name">${e(invite.name)}</div>${state.user.role === "student" ? button(t("join"), "join", "arrow") : `<p>${t("STUDENT_ONLY")}</p>`}${button(t("overview"), "overview", "", "text")}`);
  if (setup && !setupAllowed) return authLayout(`<div class="auth-heading"><span class="auth-icon">${icon("lock")}</span><h1>${t("setupTitle")}</h1><p>${t("setupNeedToken")}</p></div>`);
  const register = !setup && invite && state.authMode !== "login";
  const type = setupAllowed ? "setup" : register ? "register" : "login";
  authLayout(`<div class="auth-heading"><span class="auth-icon">${icon(type === "login" ? "leaf" : "users")}</span><p class="eyebrow">ELASTIC CLASSROOM</p><h1>${t(type === "setup" ? "setupTitle" : register ? "joinTitle" : "loginTitle")}</h1><p>${register ? t("joinIntro", { name: e(invite.name) }) : t(type === "setup" ? "setupIntro" : "loginIntro")}</p></div>
    <form data-form="${type}" class="auth-form">${type !== "login" ? field(t("fullName"), `<input name="name" autocomplete="name" required minlength="2" maxlength="80" placeholder="${t("fullName")}">`) : ""}
      ${field(t("username"), `<input name="username" autocomplete="username" required minlength="3" maxlength="32" pattern="[A-Za-z0-9_.\\-]+" placeholder="your.login" autocapitalize="none" spellcheck="false">`, type !== "login" ? t("usernameHint") : "")}
      ${field(t("password"), `<input type="password" name="password" autocomplete="${type === "login" ? "current-password" : "new-password"}" required ${type !== "login" ? 'minlength="10"' : ""} maxlength="128" placeholder="••••••••••">`, type !== "login" ? t("passwordHint") : "")}
      <div class="form-error" role="alert"></div><button class="btn primary auth-submit" type="submit">${t(type === "login" ? "login" : "createAccount")}${icon("arrow")}</button></form>
    ${register ? `<p class="auth-switch">${t("alreadyAccount")} <button class="link-button" data-action="auth-login">${t("login")}</button></p>` : type === "login" ? `<div class="auth-help">${icon("link")}<p>${t("inviteOnly")}</p></div><p class="muted auth-forgot">${t("forgotHint")}</p>${invite ? button(t("createAccount"), "auth-register", "", "text") : ""}` : ""}`);
}
async function load() {
  const request = ++state.request, route = routeInfo();
  document.body.classList.remove("menu-open");
  try {
    if (route.page === "join") {
      state.invite = await api("/invites/inspect", "POST", { token: route.token });
      if (request !== state.request) return;
      return renderAuth(route, state.invite);
    }
    if (!state.user || state.setupRequired) return renderAuth(route);
    const result = await api("/groups");
    if (request !== state.request) return;
    state.groups = result.groups;
    if (!state.mapsLoaded) { configureMaps(await api("/maps/config")); state.mapsLoaded = true; }
    if (!state.catalog.length) state.catalog = (await api("/catalog")).products;
    if (request !== state.request) return;
    if (route.page === "group") {
      const data = await api(`/groups/${route.id}`);
      if (request !== state.request) return;
      state.group = data;
      if (data.group.isAdmin) state.members = (await api(`/groups/${route.id}/members`)).members;
      if (route.tab === "history") {
        const [history, assignments] = await Promise.all([api(`/groups/${route.id}/history?${new URLSearchParams(state.filters)}`), api(`/groups/${route.id}/assignments`)]);
        state.history = history; state.assignments = assignments.assignments;
      }
      if (route.tab === "invites") state.invites = (await api(`/groups/${route.id}/invites`)).invites;
      if (route.tab === "audit") state.events = (await api(`/groups/${route.id}/audit`)).events;
      if (request !== state.request) return;
      renderGroup(); updateGps();
    } else ({ overview: renderOverview, groups: renderGroups, catalog: renderCatalog, settings: renderSettings }[route.page] || renderOverview)();
  } catch (error) {
    if (request !== state.request) return;
    if (!state.user || ["join", "setup"].includes(route.page)) renderAuth(route, null, error.message);
    else shell(`<div class="panel">${empty(t("errorTitle"), e(error.message), "info", button(t("retry"), "retry", "history"))}</div>`, t("errorTitle"));
  }
}

function catalogPicker(selected = state.catalog.map(p => p.key)) {
  return `<div class="picker-heading"><strong>${t("selectProducts")}</strong><span id="selected-count">${t("selectedCount", { count: selected.length })}</span></div><div class="picker-tools">${button(t("selectAll"), "pick-all", "", "text small")}${button(t("select30"), "pick-30", "", "text small")}${button(t("clear"), "pick-none", "", "text small")}</div><div class="catalog-picker">${["fruit", "vegetable", "grain"].map(c => `<div><p class="tiny-label">${t(c)}</p>${state.catalog.filter(p => p.category === c).map(p => `<label class="checkbox"><input type="checkbox" name="productKeys" value="${p.key}" ${selected.includes(p.key) ? "checked" : ""}><span>${emoji(p)} ${e(nameOf(p))}</span></label>`).join("")}</div>`).join("")}</div>`;
}
function newGroupDialog() {
  showDialog(t("newGroup"), `<form data-form="new-group">${field(t("groupName"), `<input name="name" required minlength="2" maxlength="80" placeholder="${t("groupNameExample")}">`)}${field(`${t("description")} · ${t("optional")}`, `<textarea name="description" rows="2" maxlength="250"></textarea>`)}${catalogPicker()}${formFooter(t("create"))}</form>`, true);
}
function addProductDialog() {
  const available = state.catalog.filter(p => !state.group.products.some(g => g.catalog_key === p.key && g.active)).map(p => p.key);
  showDialog(t("addProduct"), `<div class="mode-options"><button type="button" class="link-button" data-action="add-catalog">${t("fromCatalog")}</button><button type="button" class="link-button" data-action="add-custom">${t("customProduct")}</button></div><form data-form="add-catalog">${catalogPicker(available)}${formFooter()}</form>`, true);
}
function customProductDialog() {
  showDialog(t("customProduct"), `<form data-form="custom-product">${["uz", "en", "ru"].map(l => field(`${t("productName")} · ${languages[l]}`, `<input name="name_${l}" ${l === "uz" ? 'required minlength="2"' : ""} maxlength="100">`)).join("")}<div class="form-grid">${field(t("category"), `<select name="category">${["fruit", "vegetable", "grain", "other"].map(c => `<option value="${c}">${t(c)}</option>`).join("")}</select>`)}${field(t("unit"), `<select name="unit">${["kg", "l", "piece", "pack"].map(u => `<option value="${u}">${t(u)}</option>`).join("")}</select>`)}</div>${formFooter()}</form>`);
}
const approvedPlaces = () => (state.group?.locations || []).filter(p => p.user_id === state.user?.id && p.status === "approved");
const storeLabel = key => key === "korzinka" ? "Korzinka" : key === "secondary" ? "Havas / Mall" : t("localShop");
const gps = { watch: null, fix: null, error: "GPS_REQUIRED", inside: new Set(), group: null };
let activeMap = null;
function stopGps() {
  if (gps.watch !== null) navigator.geolocation?.clearWatch(gps.watch);
  gps.watch = null; gps.fix = null; gps.inside.clear(); gps.group = null;
}
function updateGps() {
  const time = new Date().toISOString(), places = approvedPlaces();
  for (const el of document.querySelectorAll("[data-gps-store]")) {
    const place = places.find(p => p.store_key === el.dataset.gpsStore);
    const error = !place ? "LOCATION_REQUIRED" : locationError(gps.fix, place, time);
    el.textContent = !place ? t("LOCATION_REQUIRED") : !gps.fix ? t(gps.error) :
      `${Math.round(distanceMeters(gps.fix, place))} m · ±${Math.round(gps.fix.accuracy)} m · ${t(error || "gpsReady")}`;
  }
  const priceForm = dialog.querySelector('form[data-form="prices"]');
  if (priceForm) {
    const place = places.find(p => p.store_key === priceForm.dataset.store);
    const error = !place ? "LOCATION_REQUIRED" : locationError(gps.fix, place, time);
    const submit = priceForm.querySelector('button[type="submit"]');
    if (submit && !state.busy) submit.disabled = Boolean(error) || !state.group.window.open;
  }
}
function startGps() {
  if (!window.isSecureContext) { gps.error = "GPS_HTTPS"; updateGps(); return toast(t(gps.error), true); }
  if (!navigator.geolocation) return toast(t("GPS_REQUIRED"), true);
  if (gps.watch !== null) return updateGps();
  gps.group = state.group.group.id; gps.error = "gpsSearching";
  gps.watch = navigator.geolocation.watchPosition(position => {
    if (document.hidden || routeInfo().id !== gps.group || !state.user) return stopGps();
    gps.fix = toFix(position); gps.error = ""; updateGps();
    const inside = approvedPlaces().filter(p => !locationError(gps.fix, p, new Date().toISOString()));
    const entered = inside.find(p => !gps.inside.has(p.id));
    gps.inside = new Set(inside.map(p => p.id));
    if (entered && !dialog.open && !state.busy && state.group.window.open && !state.group.group.archived && routeInfo().tab === "products" && state.group.assignment) priceDialog(entered.store_key);
  }, error => {
    gps.fix = null; gps.error = error.code === 1 ? "GPS_DENIED" : "GPS_REQUIRED"; updateGps();
  }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  updateGps();
}
function requestsPanel() {
  const admin = state.group.group.isAdmin;
  const changes = (state.group.changeRequests || []).filter(r => admin ? r.status === "pending" : true).slice(0, 12);
  const places = admin ? (state.group.locations || []).filter(p => p.status === "pending") : [];
  if (!changes.length && !places.length) return "";
  return `<section class="panel request-panel"><div class="panel-heading"><h2>${t("requestsTitle")}</h2><span class="badge green">${changes.filter(r => r.status === "pending").length + places.length}</span></div><div class="request-list">${changes.map(r => `<article class="request-row"><div><strong>${admin ? e(r.member_name) + " · " : ""}${e(nameOf(r))}</strong><p>${t("changeReason")}: ${t(`reason_${r.reason}`)}${r.note ? ` · ${e(r.note)}` : ""}</p><small>${date(r.requested_at, true)} · ${t(`request_${r.status}`)}</small></div><div class="request-actions">${r.status === "pending" ? admin ? `${button(t("approve"), "approve-change", "check", "primary small", `data-id="${r.id}"`)}${button(t("reject"), "reject-change", "", "secondary small", `data-id="${r.id}"`)}` : button(t("cancel"), "cancel-change", "", "secondary small", `data-id="${r.id}"`) : ""}</div></article>`).join("")}${places.map(p => `<article class="request-row"><div><strong>${e(p.member_name)} · ${e(p.name)}</strong><p>${storeLabel(p.store_key)} · ${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}</p></div><div class="request-actions">${button(t("viewMap"), "review-location", "", "secondary small", `data-id="${p.id}"`)}</div></article>`).join("")}</div></section>`;
}
function storesPanel() {
  if (state.group.group.isAdmin) return "";
  const locations = state.group.locations || [], approved = approvedPlaces();
  return `<section class="panel location-panel"><div class="panel-heading"><h2>${t("storeLocations")}</h2>${button(t("checkGps"), "gps-start", "", "secondary small", state.group.group.archived ? "disabled" : "")}</div><p class="gps-help">${t("gpsHint")}</p><div class="store-location-grid">${storeKeys.map(key => {
    const place = approved.find(p => p.store_key === key), latest = locations.find(p => p.store_key === key);
    const collected = state.group.collectedStores?.includes(key);
    return `<article class="store-location"><strong>${storeLabel(key)} ${collected ? "✓" : ""}</strong><p>${e(place?.name || t("LOCATION_REQUIRED"))}</p>${latest && latest.id !== place?.id ? `<small>${t(`request_${latest.status}`)} · ${e(latest.name)}</small>` : ""}<p class="gps-status" data-gps-store="${key}">${t("GPS_REQUIRED")}</p><div class="request-actions">${button(t("chooseLocation"), "store-location", "", "secondary small", `data-store="${key}" ${state.group.group.archived ? "disabled" : ""}`)}${place ? button(t("enterPrices"), "store-prices", "", "primary small", `data-store="${key}" ${!state.group.window.open || state.group.group.archived ? "disabled" : ""}`) : ""}</div></article>`;
  }).join("")}</div></section>`;
}
function locationDialog(key) {
  const place = (state.group.locations || []).find(p => p.store_key === key);
  showDialog(`${t("chooseLocation")} · ${storeLabel(key)}`, `<form data-form="location" data-store="${key}"><p class="form-intro">${t("mapHint")}</p>${field(t("shopName"), `<input name="name" required minlength="2" maxlength="100" value="${e(place?.name || "")}">`)}${key === "secondary" ? field(t("secondaryStore"), `<select name="brand"><option>Havas</option><option ${place?.brand === "Mall" ? "selected" : ""}>Mall</option></select>`) : ""}<div class="location-picker"></div><div class="form-grid">${field(t("latitude"), `<input name="latitude" type="number" step="any" min="-90" max="90" required value="${place?.latitude ?? ""}">`)}${field(t("longitude"), `<input name="longitude" type="number" step="any" min="-180" max="180" required value="${place?.longitude ?? ""}">`)}</div>${button(t("myLocation"), "map-current", "", "secondary small")}<p class="inline-note">${t("locationApprovalHint")}</p>${formFooter(t("sendRequest"))}</form>`, true);
  const form = dialog.querySelector("form");
  activeMap?.destroy(); activeMap = mountMap(dialog.querySelector(".location-picker"), place, point => {
    form.elements.latitude.value = point.latitude.toFixed(6); form.elements.longitude.value = point.longitude.toFixed(6);
    if (!form.elements.name.value.trim() && point.name) form.elements.name.value = point.name.slice(0,100);
  }, t("mapHint"), false, {search:t("mapSearch"),searchHint:t("mapSearchHint"),searching:t("mapSearching"),chooseResult:t("mapChooseResult"),noResults:t("noResults"),searchError:t("mapSearchError")});
  for (const input of [form.elements.latitude, form.elements.longitude]) input.addEventListener("change", () => {
    const latitude = Number(form.elements.latitude.value), longitude = Number(form.elements.longitude.value);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) activeMap?.set({ latitude, longitude });
  });
}
function reviewLocationDialog(id) {
  const place = state.group.locations.find(p => p.id === id);
  if (!place) return;
  showDialog(t("locationReview"), `<p class="form-intro">${e(place.member_name)} · ${e(place.name)} · ${storeLabel(place.store_key)}</p><div class="location-picker"></div><p>${place.latitude.toFixed(6)}, ${place.longitude.toFixed(6)}</p><div class="dialog-actions">${button(t("reject"), "reject-location", "", "secondary", `data-id="${id}"`)}${button(t("approve"), "approve-location", "check", "primary", `data-id="${id}"`)}</div>`, true);
  activeMap?.destroy(); activeMap = mountMap(dialog.querySelector(".location-picker"), place, () => {}, t("viewMap"), true);
}
function priceDialog(key) {
  if (!state.group.assignment) return toast(t("selectFirst"), true);
  if (!state.group.window.open || state.group.group.archived) return toast(t("WINDOW_CLOSED"), true);
  const places = approvedPlaces(), place = places.find(p => p.store_key === key);
  if (!place) {
    showDialog(t("enterPrices"), `<p class="form-intro">${t("gpsHint")}</p>${storeKeys.map(k => `<div class="request-row"><strong>${storeLabel(k)}</strong>${button(t("enterPrices"), "store-prices", "", "primary small", `data-store="${k}" ${places.some(p => p.store_key === k) ? "" : "disabled"}`)}</div>`).join("")}<p class="inline-note">${t("LOCATION_REQUIRED")}</p>${button(t("checkGps"), "gps-start", "", "secondary")}`);
    startGps(); return;
  }
  const { assignment: product, latest, today } = state.group;
  const recorded = state.group.collectedStores?.includes(key), value = latest?.[key], unavailable = recorded && value === null;
  showDialog(`${e(place.name)} · ${e(nameOf(product))}`, `<form data-form="prices" data-store="${key}"><p class="form-intro">${t("priceFormHint", { unit: t(product.unit) })}</p><p class="gps-status" data-gps-store="${key}">${t("gpsSearching")}</p>${field(t("observedDate"), `<input type="date" name="observedOn" value="${today}" max="${today}" min="${localInput(product.started_at).slice(0,10)}" required>`)}${field(`${t("price")} · ${t("currency")}`, `<input name="price" type="number" inputmode="decimal" min="0.01" max="100000000" step="0.01" ${unavailable ? "disabled" : "required"} value="${value == null ? "" : value / 100}">`)}<label class="checkbox"><input type="checkbox" name="unavailable" ${unavailable ? "checked" : ""}>${t("unavailable")}</label><p class="inline-note">${t("revisionHint")}</p>${formFooter()}</form>`);
  const check = dialog.querySelector('[name="unavailable"]'), input = dialog.querySelector('[name="price"]');
  check.onchange = () => { input.disabled = check.checked; input.required = !check.checked; };
  startGps(); updateGps();
}

function changeProductDialog(product) {
  showDialog(t("changeProduct"), `<form data-form="change-product" data-id="${product.id}">
    <div class="change-summary"><span>${e(nameOf(state.group.assignment))}</span>${icon("arrow")}<strong>${e(nameOf(product))}</strong></div>
    <p class="form-intro">${t("approvalChangeHint")}</p>
    ${field(t("changeReason"), `<select name="reason" required><option value="">${t("selectReason")}</option>${["unavailable", "discontinued", "seasonal", "other"].map(reason => `<option value="${reason}">${t(`reason_${reason}`)}</option>`).join("")}</select>`)}
    ${field(t("reasonNote"), `<textarea name="reasonNote" rows="3" maxlength="500" placeholder="${t("reasonNoteHint")}"></textarea>`)}
    <p class="inline-note">${icon("info")}${t("reasonRequiredHint")}</p>${formFooter(t("sendRequest"))}</form>`);
}
function recordDialog(id) {
  const r = state.history.records.find(row => row.id === id);
  if (!r) return;
  showDialog(`${e(nameOf(r))} · ${e(r.member_name)}`, `<p class="form-intro">${t("assignmentPeriod")}: ${date(r.started_at, true)} → ${r.ended_at ? date(r.ended_at, true) : t("ongoing")}</p>${r.ended_at ? `<div class="reason-box"><strong>${t("changeReason")}</strong><div>${reasonContent(r)}</div></div>` : ""}<div class="revision-list">${r.revisions.map(v => `<article class="revision-card"><div class="row"><span class="badge green">${t("revision", { count: v.version })}</span><span class="muted">${date(v.created_at, true)}</span></div><p>${t("observedDate")}: ${date(v.observed_on)}</p><div class="revision-prices"><div><span>Korzinka</span><strong>${v.collectedStores?.includes("korzinka") ? money(v.korzinka) : t("notCollected")}</strong></div><div><span>${e(v.secondary_store)}</span><strong>${v.collectedStores?.includes("secondary") ? money(v.secondary) : t("notCollected")}</strong></div><div><span>${e(v.local_store)}</span><strong>${v.collectedStores?.includes("local") ? money(v.local) : t("notCollected")}</strong></div></div><small class="muted">${t("currency")} / 1 ${t(r.unit)}</small>${v.observations?.map(o => `<p class="gps-status">${e(o.location_name)} · ${Math.round(o.distance)} m · ±${Math.round(o.accuracy)} m · ${date(o.measured_at, true)}</p>`).join("") || ""}</article>`).join("")}</div>`, true);
}
function newInviteDialog() {
  showDialog(t("newInvite"), `<form data-form="new-invite"><p class="form-intro">${t("invitePrivacy")}</p>${field(`${t("expiresAt")} · ${t("optional")}`, `<input type="datetime-local" name="expiresAt">`)}${field(`${t("maxUses")} · ${t("optional")}`, `<input type="number" name="maxUses" min="1" max="10000" placeholder="${t("unlimited")}">`)}${formFooter(t("create"))}</form>`);
}
function updateProductList() {
  const target = document.querySelector("#product-list");
  if (target) target.innerHTML = routeInfo().page === "catalog" ? filteredProducts(state.catalog).map(catalogCard).join("") || empty(t("noResults"), t("tryFilter")) : productList();
}

document.addEventListener("click", async event => {
  const el = event.target.closest("[data-action]");
  if (!el || el.disabled || state.busy) return;
  const action = el.dataset.action, id = Number(el.dataset.id), groupId = state.group?.group.id;
  try {
    switch (action) {
      case "gps-start": stopGps(); startGps(); break;
      case "store-location": locationDialog(el.dataset.store); break;
      case "store-prices": priceDialog(el.dataset.store); break;
      case "review-location": reviewLocationDialog(id); break;
      case "map-current": {
        const originalLabel = el.textContent, mapAtStart = activeMap;
        el.disabled = true; el.textContent = t("gpsSearching");
        try { const point = await currentFix({ onProgress: fix => { if (el.isConnected) el.textContent = t("gpsAccuracy", {n:Math.round(fix.accuracy)}); } });
          if (activeMap !== mapAtStart || !el.isConnected) break;
          activeMap?.set(point); const f = dialog.querySelector('form[data-form="location"]');
          if (f) { f.elements.latitude.value = point.latitude.toFixed(6); f.elements.longitude.value = point.longitude.toFixed(6); }
        } catch (error) { toast(t(error.message), true); }
        finally { el.disabled = false; el.textContent = originalLabel; } break;
      }
      case "approve-change": case "reject-change": case "cancel-change":
      case "approve-location": case "reject-location": {
        const [decision, type] = action.split("-");
        confirmDialog(t(decision === "approve" ? "approve" : decision === "reject" ? "reject" : "cancel"), t("reviewConfirm"), async () => {
          await api(`/groups/${groupId}/${type === "change" ? "changes" : "locations"}/${id}/${decision}`, "POST", {});
          closeDialog(); toast(t("saved")); await load();
        }); break;
      }
      case "theme": setTheme(state.theme === "dark" ? "light" : "dark"); break;
      case "menu": document.body.classList.toggle("menu-open"); break;
      case "close-dialog": closeDialog(); break;
      case "overview": go("overview"); break;
      case "retry": await load(); break;
      case "new-group": newGroupDialog(); break;
      case "logout": stopGps(); configureMaps({}); state.mapsLoaded = false; await api("/logout", "POST", {}); state.user = null; state.csrf = null; state.authMode = null; go("overview"); break;
      case "auth-login": state.authMode = "login"; renderAuth(routeInfo(), state.invite); break;
      case "auth-register": state.authMode = null; renderAuth(routeInfo(), state.invite); break;
      case "back-login": state.authMode = null; go("overview"); break;
      case "join": {
        const result = await api("/join", "POST", { token: routeInfo().token });
        state.authMode = null; go(`group/${result.groupId}/products`); break;
      }
      case "category":
        state.category = el.dataset.value;
        document.querySelectorAll("[data-action=category]").forEach(b => b.classList.toggle("active", b === el));
        updateProductList(); break;
      case "change-product":
        state.availableOnly = true; state.category = "all"; state.search = ""; renderGroup();
        document.querySelector("#product-search")?.focus(); break;
      case "select-product": {
        const p = state.group.products.find(product => product.id === id);
        if (state.group.assignment) changeProductDialog(p);
        else confirmDialog(t("selectConfirm", { name: e(nameOf(p)) }), t("step1Text"), async () => {
            await api(`/groups/${groupId}/assign`, "POST", { productId: id }); closeDialog(); toast(t("selectedSuccess")); await load();
          });
        break;
      }
      case "confirm":
        if (state.confirm) { state.busy = true; el.disabled = true; try { await state.confirm(); } finally { state.busy = false; el.disabled = false; } } break;
      case "prices": priceDialog(); break;
      case "add-product": case "add-catalog": addProductDialog(); break;
      case "add-custom": customProductDialog(); break;
      case "archive-product":
        confirmDialog(t("archiveProduct"), t("archiveProductConfirm"), async () => {
          await api(`/groups/${groupId}/products/${id}`, "DELETE", {}); closeDialog(); toast(t("saved")); await load();
        }); break;
      case "archive-group":
        confirmDialog(t(state.group.group.archived ? "groupRestore" : "groupArchive"), t("archiveConfirm"), async () => {
          await api(`/groups/${groupId}/archive`, "POST", { archived: !state.group.group.archived }); closeDialog(); toast(t("saved")); await load();
        }); break;
      case "pick-all": case "pick-30": case "pick-none":
        dialog.querySelectorAll('input[name="productKeys"]').forEach(input => {
          input.checked = action === "pick-all" || (action === "pick-30" && Number(input.value.split("-")[1]) <= 10);
        });
        document.querySelector("#selected-count").textContent = t("selectedCount", { count: dialog.querySelectorAll('input[name="productKeys"]:checked').length }); break;
      case "new-invite": newInviteDialog(); break;
      case "copy-link": {
        const input = dialog.querySelector("#invite-link");
        try { await navigator.clipboard.writeText(input.value); toast(t("copied")); }
        catch { input.focus(); input.select(); toast(t("copyManually")); } break;
      }
      case "revoke-invite":
        confirmDialog(t("revoke"), t("revokeConfirm"), async () => {
          await api(`/groups/${groupId}/invites/${id}`, "DELETE", {}); closeDialog(); toast(t("saved")); await load();
        }); break;
      case "record": recordDialog(id); break;
      case "member-history": state.filters = { member: String(id) }; go(`group/${groupId}/history`); break;
      case "remove-member": {
        const m = state.members.find(member => member.id === id);
        confirmDialog(t("removeMember"), t("removeConfirm", { name: e(m.name) }), async () => {
          await api(`/groups/${groupId}/members/${id}/remove`, "POST", {}); closeDialog(); toast(t("saved")); await load();
        }); break;
      }
      case "reset-password":
        showDialog(t("resetPassword"), `<form data-form="reset-password" data-id="${id}"><p class="form-intro">${t("resetHint")}</p>${field(t("newPassword"), '<input type="password" name="password" required minlength="10" maxlength="128" autocomplete="new-password">', t("passwordHint"))}${formFooter()}</form>`); break;
      case "page-prev": case "page-next": state.filters.page = String(state.history.page + (action === "page-next" ? 1 : -1)); await load(); break;
    }
  } catch (error) { toast(error.message, true); }
});
document.addEventListener("input", event => {
  if (event.target.id === "product-search") { state.search = event.target.value; updateProductList(); }
  if (event.target.id === "group-search") {
    const term = event.target.value.toLocaleLowerCase();
    document.querySelector("#group-list").innerHTML = state.groups.filter(g => `${g.name} ${g.description}`.toLocaleLowerCase().includes(term)).map(groupCard).join("") || empty(t("noResults"), t("tryFilter"));
  }
});
document.addEventListener("change", event => {
  const el = event.target;
  if (el.matches("[data-language]")) {
    state.lang = el.value; localStorage.setItem("micro-language", state.lang);
    closeDialog(); load();
  }
  if (el.id === "available-only") { state.availableOnly = el.checked; updateProductList(); }
  if (el.name === "productKeys") document.querySelector("#selected-count").textContent = t("selectedCount", { count: dialog.querySelectorAll('input[name="productKeys"]:checked').length });
  if (el.matches("[data-price-unavailable]")) {
    const input = el.form.elements[el.dataset.priceUnavailable]; input.disabled = el.checked; input.required = !el.checked;
  }
  if (el.name === "reason") {
    const note = el.form.elements.reasonNote;
    note.required = el.value === "other";
    if (note.required) note.minLength = 5;
    else note.removeAttribute("minlength");
  }
  if (el.name === "mode") {
    el.form.querySelectorAll("[data-mode]").forEach(section => { section.hidden = section.dataset.mode !== el.value; section.disabled = section.hidden; });
  }
});
document.addEventListener("submit", async event => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault(); if (state.busy) return;
  const data = new FormData(form), values = Object.fromEntries(data), kind = form.dataset.form;
  const submit = form.querySelector('button[type="submit"]'), errorBox = form.querySelector(".form-error");
  if (errorBox) errorBox.textContent = "";
  state.busy = true; if (submit) submit.disabled = true;
  try {
    const groupId = state.group?.group.id;
    if (["login", "register", "setup"].includes(kind)) {
      const result = await api(`/${kind}`, "POST", { ...values, token: routeInfo().token });
      state.user = result.user; state.csrf = result.csrf; state.setupRequired = false; state.authMode = null;
      if (result.groupId) go(`group/${result.groupId}/products`);
      else if (kind === "login" && routeInfo().page === "join") await load();
      else go("overview");
    } else if (kind === "new-group") {
      const result = await api("/groups", "POST", { ...values, productKeys: data.getAll("productKeys") });
      toast(t("groupCreated")); go(`group/${result.id}/products`);
    } else if (kind === "add-catalog" || kind === "custom-product") {
      await api(`/groups/${groupId}/products`, "POST", kind === "add-catalog" ? { productKeys: data.getAll("productKeys") } : values);
      closeDialog(); toast(t("saved")); await load();
    } else if (kind === "location") {
      await api(`/groups/${groupId}/locations`, "POST", { storeKey: form.dataset.store, name: values.name,
        brand: values.brand, latitude: Number(values.latitude), longitude: Number(values.longitude) });
      closeDialog(); toast(t("requestSent")); await load();
    } else if (kind === "prices") {
      const key = form.dataset.store;
      let fix; try { fix = await currentFix(); } catch (error) { throw new Error(t(error.message)); }
      gps.fix = fix;
      await api(`/groups/${groupId}/submissions`, "POST", {
        assignmentId: state.group.assignment.id, observedOn: values.observedOn,
        storeKey: key, [key]: values.unavailable ? null : Number(values.price), location: fix
      });
      closeDialog(); toast(t("priceSaved")); await load();
    } else if (kind === "change-product") {
      await api(`/groups/${groupId}/assign`, "POST", {
        productId: Number(form.dataset.id), reason: values.reason, reasonNote: values.reasonNote
      });
      closeDialog(); toast(t("requestSent")); await load();
    } else if (kind === "schedule") {
      const payload = { mode: values.mode };
      if (values.mode === "manual") payload.open = data.has("open");
      else if (values.mode === "single") { payload.start = fromLocal(values.start); payload.end = fromLocal(values.end); }
      else {
        payload.weekday = Number(values.weekday);
        const [hours, minutes] = values.time.split(":").map(Number);
        payload.minute = hours * 60 + minutes; payload.durationMinutes = Number(values.duration) * 60;
      }
      await api(`/groups/${groupId}/schedule`, "POST", payload); toast(t("saved")); await load();
    } else if (kind === "new-invite") {
      const result = await api(`/groups/${groupId}/invites`, "POST", { expiresAt: fromLocal(values.expiresAt), maxUses: values.maxUses ? Number(values.maxUses) : null });
      showDialog(t("inviteCreated"), `<div class="success-icon">${icon("check")}</div><p class="form-intro">${t("linkOnce")}</p><label class="field"><span>${t("invites")}</span><input id="invite-link" value="${e(`${location.origin}/#join=${result.token}`)}" readonly></label><div class="dialog-actions">${button(t("copy"), "copy-link", "copy")}${button(t("close"), "close-dialog", "", "secondary")}</div>`);
      await load();
    } else if (kind === "history") {
      state.filters = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
      await load();
    } else if (kind === "reset-password") {
      await api(`/groups/${groupId}/members/${form.dataset.id}/password`, "POST", values);
      closeDialog(); toast(t("saved"));
    } else if (kind === "password") {
      const result = await api("/account/password", "POST", values);
      state.csrf = result.csrf; toast(t("saved")); form.reset();
    }
  } catch (error) {
    if (errorBox && errorBox.isConnected) errorBox.textContent = error.message;
    else toast(error.message, true);
  } finally { state.busy = false; if (submit?.isConnected) submit.disabled = false; }
});
window.addEventListener("hashchange", () => {
  const route = routeInfo();
  if (route.id !== state.lastGroup || route.tab !== "products") stopGps();
  if (route.id !== state.lastGroup) { state.filters = {}; state.lastGroup = route.id; }
  state.search = ""; state.category = "all"; closeDialog(); load(); window.scrollTo(0, 0);
});
document.addEventListener("visibilitychange", () => { if (document.hidden) stopGps(); });
setInterval(updateGps, 3000);
// Refresh server-controlled windows without interrupting forms or typed filters.
setInterval(async () => {
  if (!state.user || document.hidden || dialog.open || state.busy || routeInfo().page !== "group") return;
  const route = routeInfo();
  try {
    const fresh = await api(`/groups/${route.id}`);
    if (routeInfo().id === route.id && !dialog.open && !state.busy && (fresh.window.open !== state.group?.window.open || JSON.stringify([fresh.changeRequests,fresh.locations,fresh.assignment]) !== JSON.stringify([state.group?.changeRequests,state.group?.locations,state.group?.assignment]))) {
      state.group = fresh; await load();
    }
  } catch { /* A foreground action will display connection errors. */ }
}, 30000);
try {
  const session = await api("/session");
  state.user = session.user; state.csrf = session.csrf; state.setupRequired = session.setupRequired;
  state.lastGroup = routeInfo().id;
  await load();
} catch (error) {
  authLayout(`<h1>ELASTIC</h1><p>${e(error.message)}</p>${button(t("retry"), "retry", "history")}`);
}
