export const storeKeys = ["korzinka", "secondary", "local"];
export function coordinates(value) {
  return value && typeof value.latitude === "number" && Number.isFinite(value.latitude) && Math.abs(value.latitude) <= 90 &&
    typeof value.longitude === "number" && Number.isFinite(value.longitude) && Math.abs(value.longitude) <= 180;
}
export function distanceMeters(a, b) {
  const rad = n => n * Math.PI / 180;
  const lat = rad(b.latitude - a.latitude), lon = rad(b.longitude - a.longitude);
  const h = Math.sin(lat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(lon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1, h)), Math.sqrt(Math.max(0, 1 - h)));
}
export function locationError(fix, place, now) {
  if (!coordinates(fix) || typeof fix.accuracy !== "number" || !Number.isFinite(fix.accuracy) || fix.accuracy <= 0 ||
      typeof fix.timestamp !== "number" || !Number.isFinite(fix.timestamp)) return "GPS_REQUIRED";
  const age = Date.parse(now) - fix.timestamp;
  if (age > 30000 || age < -5000) return "GPS_STALE";
  if (fix.accuracy > 50) return "GPS_INACCURATE";
  if (distanceMeters(fix, place) > 100) return "GPS_OUTSIDE";
  return null;
}
