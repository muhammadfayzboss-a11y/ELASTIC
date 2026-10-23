export { storeKeys, distanceMeters, locationError } from "./geo.js";
export function currentFix() {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error("GPS_HTTPS"));
    if (!navigator.geolocation) return reject(new Error("GPS_REQUIRED"));
    navigator.geolocation.getCurrentPosition(position => resolve(toFix(position)),
      error => reject(new Error(error.code === 1 ? "GPS_DENIED" : "GPS_REQUIRED")),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  });
}
export function toFix(position) {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude,
    accuracy: position.coords.accuracy, timestamp: position.timestamp };
}
// Small interactive OpenStreetMap picker. No third-party JavaScript or API key.
export function mountMap(container, initial, onPick, label, readOnly = false) {
  let center = { latitude: initial?.latitude ?? 41.3111, longitude: initial?.longitude ?? 69.2797 };
  let selected = initial ? { ...center } : null, zoom = initial ? 17 : 12, drag;
  container.className = "location-map";
  container.tabIndex = 0; container.setAttribute("role", "application"); container.setAttribute("aria-label", label);
  const tiles = document.createElement("div"); tiles.className = "map-tiles";
  const pin = document.createElement("span"); pin.className = "map-pin"; pin.textContent = "●"; pin.setAttribute("aria-hidden", "true");
  const controls = document.createElement("div"); controls.className = "map-controls";
  for (const [text, delta] of [["+", 1], ["−", -1]]) {
    const b = document.createElement("button"); b.type = "button"; b.textContent = text;
    b.setAttribute("aria-label", delta === 1 ? "+ Zoom" : "− Zoom");
    b.onclick = () => { zoom = Math.max(2, Math.min(19, zoom + delta)); draw(); }; controls.append(b);
  }
  const credit = document.createElement("a"); credit.className = "map-credit";
  credit.href = "https://www.openstreetmap.org/copyright"; credit.target = "_blank"; credit.rel = "noopener noreferrer";
  credit.textContent = "© OpenStreetMap contributors";
  container.append(tiles, pin, controls, credit);
  function world(point) {
    const size = 256 * 2 ** zoom, latitude = Math.max(-85, Math.min(85, point.latitude)) * Math.PI / 180;
    return { x: (point.longitude + 180) / 360 * size,
      y: (1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2 * size };
  }
  function point(x, y) {
    const size = 256 * 2 ** zoom;
    return { longitude: ((x / size * 360 + 180) % 360 + 360) % 360 - 180,
      latitude: Math.atan(Math.sinh(Math.PI * (1 - 2 * Math.max(0, Math.min(size, y)) / size))) * 180 / Math.PI };
  }
  function draw() {
    if (!container.isConnected) return;
    const c = world(center), w = container.clientWidth, h = container.clientHeight, n = 2 ** zoom;
    tiles.replaceChildren();
    for (let x = Math.floor((c.x - w / 2) / 256); x <= Math.floor((c.x + w / 2) / 256); x++) {
      for (let y = Math.floor((c.y - h / 2) / 256); y <= Math.floor((c.y + h / 2) / 256); y++) {
        if (y < 0 || y >= n) continue;
        const tile = document.createElement("img"); tile.alt = ""; tile.draggable = false;
        tile.referrerPolicy = "origin";
        tile.src = `https://tile.openstreetmap.org/${zoom}/${((x % n) + n) % n}/${y}.png`;
        tile.style.left = `${x * 256 - c.x + w / 2}px`; tile.style.top = `${y * 256 - c.y + h / 2}px`;
        tiles.append(tile);
      }
    }
    pin.hidden = !selected;
    if (selected) { const m = world(selected); pin.style.left = `${m.x - c.x + w / 2}px`; pin.style.top = `${m.y - c.y + h / 2}px`; }
  }
  container.addEventListener("pointerdown", event => {
    if (event.target.closest("button,a")) return;
    drag = { x: event.clientX, y: event.clientY, center: world(center) }; container.setPointerCapture(event.pointerId);
  });
  container.addEventListener("pointerup", event => {
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (Math.hypot(dx, dy) > 5) center = point(drag.center.x - dx, drag.center.y - dy);
    else if (!readOnly) {
      const rect = container.getBoundingClientRect(), c = world(center);
      selected = point(c.x + event.clientX - rect.left - rect.width / 2, c.y + event.clientY - rect.top - rect.height / 2);
      onPick(selected);
    }
    drag = null; draw();
  });
  container.addEventListener("pointercancel", () => { drag = null; });
  container.addEventListener("keydown", event => {
    const move = { ArrowUp: [0,-100], ArrowDown: [0,100], ArrowLeft: [-100,0], ArrowRight: [100,0] }[event.key];
    if (move) { event.preventDefault(); const c = world(center); center = point(c.x + move[0], c.y + move[1]); draw(); }
    if (event.key === "Enter" && !readOnly) { event.preventDefault(); selected = { ...center }; onPick(selected); draw(); }
  });
  const observer = new ResizeObserver(draw); observer.observe(container); draw();
  return { set(value) { selected = center = { ...value }; zoom = 17; draw(); }, destroy() { observer.disconnect(); } };
}
