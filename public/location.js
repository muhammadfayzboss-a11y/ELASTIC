import { coordinates } from "./geo.js";
let mapsConfig = { apiKey: "" };
export function configureMaps(value) { mapsConfig = { apiKey: typeof value?.apiKey === "string" ? value.apiKey : "" }; }
export { storeKeys, distanceMeters, locationError } from "./geo.js";
export const isAppleStandalone = () => navigator.standalone === true;
const freshFix = (fix, now = Date.now()) => coordinates(fix) && Number.isFinite(fix.timestamp) &&
  Number.isFinite(fix.accuracy) && fix.accuracy > 0 && now - fix.timestamp <= 30000 && now - fix.timestamp >= -5000;
// Keep a recent precise reading through a coarse network update; precise movement wins immediately.
export function selectFix(previous, next, now = Date.now()) {
  if (!freshFix(next, now)) return freshFix(previous, now) ? previous : null;
  if (freshFix(previous, now) && (next.timestamp < previous.timestamp || previous.accuracy <= 50 && next.accuracy > 50)) return previous;
  return next;
}
// Refresh stalled watches, including stationary iPhones that stop delivering fresh timestamps.
// Permission denial is terminal; only a new user action may request it again.
export function watchFix(onFix, onError, { retryAfter = 20000 } = {}) {
  if (!window.isSecureContext) { onError("GPS_HTTPS"); return () => {}; }
  if (!navigator.geolocation) { onError("GPS_REQUIRED"); return () => {}; }
  let id = null, closed = false, generation = 0, best = null, requestedAt = 0;
  const clear = () => { if (id !== null) { navigator.geolocation.clearWatch(id); id = null; } };
  const stop = () => { closed = true; generation++; clearInterval(heartbeat); clear(); };
  const request = () => {
    clear(); const version = ++generation; requestedAt = Date.now();
    const watchId = navigator.geolocation.watchPosition(position => {
      if (closed || version !== generation) return;
      const next = selectFix(best, toFix(position));
      if (next && next !== best) { best = next; onFix(next); }
    }, error => {
      if (closed || version !== generation) return;
      if (error.code === 1) stop();
      onError(error.code === 1 ? "GPS_DENIED" : error.code === 3 ? "GPS_TIMEOUT" : "GPS_UNAVAILABLE");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    id = watchId;
    if (closed) clear();
  };
  const heartbeat = setInterval(() => {
    if (closed || Date.now() - requestedAt < retryAfter) return;
    if (!best || best.accuracy > 50 || Date.now() - best.timestamp >= retryAfter) request();
  }, Math.min(5000, retryAfter));
  request();
  return stop;
}
// Wait for a precise fresh fix instead of accepting the first coarse network position.
export function currentFix({ onProgress = () => {}, timeout = 45000, signal } = {}) {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error("GPS_HTTPS"));
    if (!navigator.geolocation) return reject(new Error("GPS_REQUIRED"));
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    let stopWatch = null, best = null, settled = false, settleTimer = null, lastError = "GPS_TIMEOUT";
    const finish = (error) => {
      if (settled) return;
      if (!error && best && (Date.now() - best.timestamp > 30000 || Date.now() - best.timestamp < -5000)) error = "GPS_STALE";
      settled = true; clearTimeout(deadline); clearTimeout(settleTimer);
      signal?.removeEventListener("abort", abort); stopWatch?.();
      error ? reject(new Error(error)) : resolve(best);
    };
    const abort = () => { finish("GPS_CANCELLED"); };
    const deadline = setTimeout(() => finish(best && best.accuracy <= 50 ? null : best ? "GPS_INACCURATE" : lastError), timeout);
    signal?.addEventListener("abort", abort, { once: true });
    const stop = watchFix(fix => {
      if (settled) return;
      if (!best || !freshFix(best) || fix.accuracy <= best.accuracy) { best = fix; onProgress(fix); }
      if (best.accuracy <= 20) finish(null);
      else if (best.accuracy <= 50 && !settleTimer) settleTimer = setTimeout(() => finish(null), Math.min(4000, timeout));
    }, code => { lastError = code; if (["GPS_DENIED", "GPS_HTTPS", "GPS_REQUIRED"].includes(code)) finish(code); });
    stopWatch = stop; if (settled) stop();
  });
}
// Do not request access on load. Resume only a check explicitly started by the user.
export function bindGpsLifecycle({ active, suspend, resume, doc = document, page = window }) {
  let pending = false;
  const hide = () => { pending = active() || pending; suspend(); };
  const show = () => { if (!doc.hidden && pending) { const context = pending; pending = false; resume(context); } };
  const visibility = () => doc.hidden ? hide() : show();
  doc.addEventListener("visibilitychange", visibility);
  page.addEventListener("pagehide", hide); page.addEventListener("pageshow", show);
  return () => { doc.removeEventListener("visibilitychange", visibility); page.removeEventListener("pagehide", hide); page.removeEventListener("pageshow", show); };
}
export function toFix(position) {
  return { latitude: position?.coords?.latitude, longitude: position?.coords?.longitude,
    accuracy: position?.coords?.accuracy, timestamp: position?.timestamp };
}
// Leaflet 1.9.4 is served locally; coordinates are obtained from Leaflet's projection.
export function mountMap(container, initial, onPick, label, readOnly = false, labels = {}) {
  const L = window.L;
  container.className = "location-map";
  container.setAttribute("aria-label", label);
  const start = initial ? [initial.latitude, initial.longitude] : [41.3111,69.2797];
  const map = L.map(container, {center:start,zoom:initial?17:12,inertia:true,zoomAnimation:true,
    scrollWheelZoom:true,touchZoom:true,keyboard:true,preferCanvas:true,zoomSnap:0.5,zoomDelta:0.5,wheelDebounceTime:30});
  const osmCredit = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const apiKey = mapsConfig.apiKey;
  const tileUrl = apiKey ? `https://maps.geoapify.com/v1/tile/osm-bright-smooth/{z}/{x}/{y}.png?apiKey=${encodeURIComponent(apiKey)}` : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
  const tiles = L.tileLayer(tileUrl, {maxZoom:19,attribution:apiKey ? '<a href="https://www.geoapify.com/" target="_blank" rel="noopener">Powered by Geoapify</a> | '+osmCredit : osmCredit,
    referrerPolicy:"origin",updateWhenIdle:true,keepBuffer:2}).addTo(map);
  let tileErrors = 0, fallback = false;
  tiles.on("tileerror", () => {
    if (!apiKey || fallback || ++tileErrors < 3) return;
    fallback = true; map.removeLayer(tiles);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19,attribution:osmCredit,referrerPolicy:"origin",updateWhenIdle:true,keepBuffer:2}).addTo(map);
  });
  let marker, circle;
  function select(point, notify=false) {
    const latlng=L.latLng(point.latitude,point.longitude).wrap();
    if (!marker) {
      marker=L.marker(latlng,{draggable:!readOnly,icon:L.divIcon({className:"shop-map-marker",html:"<span>●</span>",iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map);
      marker.on("dragend",()=>{const p=marker.getLatLng();select({latitude:p.lat,longitude:p.lng},true);});
      circle=L.circle(latlng,{radius:100,color:"#174f41",weight:2,fillColor:"#82b779",fillOpacity:0.18}).addTo(map);
    } else {marker.setLatLng(latlng);circle.setLatLng(latlng);}
    if(notify) onPick({latitude:latlng.lat,longitude:latlng.lng,name:point.name || ""});
  }
  if(initial) select(initial);
  if(!readOnly) map.on("click",event=>select({latitude:event.latlng.lat,longitude:event.latlng.lng},true));
  let searchBox, controller, searchVersion = 0;
  if (apiKey && !readOnly) {
    searchBox = document.createElement("div"); searchBox.className="map-search";
    const row=document.createElement("div"), input=document.createElement("input"), button=document.createElement("button"), status=document.createElement("p"), results=document.createElement("div");
    row.className="map-search-row";input.type="search";input.maxLength=160;input.placeholder=labels.searchHint || "Address";input.setAttribute("aria-label",input.placeholder);
    button.type="button";button.className="btn secondary small";button.textContent=labels.search || "Search";
    status.className="gps-status";status.setAttribute("role","status");results.className="map-results";
    row.append(input,button);searchBox.append(row,status,results);container.before(searchBox);
    const search = async () => {
      const query=input.value.trim();if(query.length<3) {status.textContent=labels.searchHint || "Enter an address";return;}
      const version=++searchVersion;controller?.abort();controller=new AbortController();
      status.textContent=labels.searching || "Searching…";button.disabled=true;results.replaceChildren();
      const params=new URLSearchParams({text:query,filter:"countrycode:uz",format:"json",limit:"5",apiKey});
      try {
        const response=await fetch(`https://api.geoapify.com/v1/geocode/search?${params}`,{signal:controller.signal,referrerPolicy:"origin"});
        if(!response.ok) throw new Error("SEARCH_FAILED");
        const data=await response.json();if(version!==searchVersion || !searchBox.isConnected)return;
        const found=(data.results || []).filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
        status.textContent=found.length ? labels.chooseResult || "Choose a result" : labels.noResults || "No results";
        for(const place of found){
          const b=document.createElement("button");b.type="button";b.className="map-result";b.textContent=place.formatted || place.name || query;
          b.onclick=()=>{select({latitude:place.lat,longitude:place.lon,name:place.name || query},true);map.flyTo([place.lat,place.lon],17,{duration:0.7});results.replaceChildren();status.textContent=place.formatted || query;};results.append(b);
        }
      } catch(error){if(error.name!=="AbortError" && searchBox.isConnected)status.textContent=labels.searchError || "Search unavailable. Select on the map.";}
      finally {if(version===searchVersion)button.disabled=false;}
    };
    button.onclick=search;
    input.addEventListener("keydown",event=>{if(event.key==="Enter"){event.preventDefault();event.stopPropagation();search();}});
  }
  let resizeFrame; const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>map.invalidateSize({pan:false,debounceMoveend:true}));});observer.observe(container);
  return {set(point){select(point);map.setView([point.latitude,point.longitude],17,{animate:true});},
    destroy(){searchVersion++;controller?.abort();searchBox?.remove();cancelAnimationFrame(resizeFrame);observer.disconnect();map.remove();}};
}
