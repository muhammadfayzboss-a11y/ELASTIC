export { storeKeys, distanceMeters, locationError } from "./geo.js";
// Wait for a precise fresh fix instead of accepting the first coarse network position.
export function currentFix({ onProgress = () => {}, timeout = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!window.isSecureContext) return reject(new Error("GPS_HTTPS"));
    if (!navigator.geolocation) return reject(new Error("GPS_REQUIRED"));
    let watch = null, best = null, settled = false, settleTimer = null;
    const finish = (error) => {
      if (settled) return;
      settled = true; clearTimeout(deadline); clearTimeout(settleTimer);
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      error ? reject(new Error(error)) : resolve(best);
    };
    const deadline = setTimeout(() => finish(best && best.accuracy <= 50 ? null : best ? "GPS_INACCURATE" : "GPS_REQUIRED"), timeout);
    watch = navigator.geolocation.watchPosition(position => {
      if (settled) return;
      const fix = toFix(position), age = Date.now() - fix.timestamp;
      if (!Number.isFinite(fix.accuracy) || fix.accuracy <= 0 || age > 30000 || age < -5000) return;
      if (!best || fix.accuracy < best.accuracy) { best = fix; onProgress(fix); }
      if (best.accuracy <= 20) finish(null);
      else if (best.accuracy <= 50 && !settleTimer) settleTimer = setTimeout(() => finish(null), Math.min(4000, timeout));
    }, error => { if (error.code === 1) finish("GPS_DENIED"); },
      { enableHighAccuracy: true, maximumAge: 0, timeout });
  });
}
export function toFix(position) {
  return { latitude: position.coords.latitude, longitude: position.coords.longitude,
    accuracy: position.coords.accuracy, timestamp: position.timestamp };
}
// Leaflet 1.9.4 is served locally; coordinates are obtained from Leaflet's projection.
export function mountMap(container, initial, onPick, label, readOnly = false) {
  const L = window.L;
  container.className = "location-map";
  container.setAttribute("aria-label", label);
  const start = initial ? [initial.latitude, initial.longitude] : [41.3111,69.2797];
  const map = L.map(container, {center:start,zoom:initial?17:12,inertia:true,zoomAnimation:true,
    scrollWheelZoom:true,touchZoom:true,keyboard:true,preferCanvas:true,zoomSnap:0.5,zoomDelta:0.5,wheelDebounceTime:30});
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19,
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    referrerPolicy:"origin",updateWhenIdle:true,keepBuffer:2}).addTo(map);
  let marker, circle;
  function select(point, notify=false) {
    const latlng=L.latLng(point.latitude,point.longitude);
    if (!marker) {
      marker=L.marker(latlng,{draggable:!readOnly,icon:L.divIcon({className:"shop-map-marker",html:"<span>●</span>",iconSize:[26,26],iconAnchor:[13,13]})}).addTo(map);
      marker.on("dragend",()=>{const p=marker.getLatLng();select({latitude:p.lat,longitude:p.lng},true);});
      circle=L.circle(latlng,{radius:100,color:"#174f41",weight:2,fillColor:"#82b779",fillOpacity:0.18}).addTo(map);
    } else {marker.setLatLng(latlng);circle.setLatLng(latlng);}
    if(notify) onPick({latitude:latlng.lat,longitude:latlng.lng});
  }
  if(initial) select(initial);
  if(!readOnly) map.on("click",event=>select({latitude:event.latlng.lat,longitude:event.latlng.lng},true));
  let resizeFrame; const observer=new ResizeObserver(()=>{cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>map.invalidateSize({pan:false,debounceMoveend:true}));});observer.observe(container);
  return {set(point){select(point);map.setView([point.latitude,point.longitude],17,{animate:true});},
    destroy(){cancelAnimationFrame(resizeFrame);observer.disconnect();map.remove();}};
}
