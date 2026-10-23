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
// Leaflet 1.9.4 is served locally; coordinates are obtained from Leaflet's projection.
export function mountMap(container, initial, onPick, label, readOnly = false) {
  const L = window.L;
  container.className = "location-map";
  container.setAttribute("aria-label", label);
  const start = initial ? [initial.latitude, initial.longitude] : [41.3111,69.2797];
  const map = L.map(container, {center:start,zoom:initial?17:12,inertia:true,zoomAnimation:true,
    scrollWheelZoom:true,touchZoom:true,keyboard:true});
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
  const observer=new ResizeObserver(()=>map.invalidateSize({pan:false}));observer.observe(container);
  return {set(point){select(point);map.setView([point.latitude,point.longitude],17,{animate:true});},
    destroy(){observer.disconnect();map.remove();}};
}
