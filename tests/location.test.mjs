import test from "node:test";
import assert from "node:assert/strict";
import { currentFix } from "../public/location.js";
async function withGPS(run, action) {
  const descriptors = Object.fromEntries(["window","navigator"].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  let cleared=0;
  Object.defineProperty(globalThis,"window",{value:{isSecureContext:true},configurable:true});
  Object.defineProperty(globalThis,"navigator",{value:{geolocation:{watchPosition(ok,bad){queueMicrotask(()=>run(ok,bad));return 17;},clearWatch(id){assert.equal(id,17);cleared++;}}},configurable:true});
  try { await action(()=>cleared); } finally { for(const [key,d] of Object.entries(descriptors)) { if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key]; } }
}
const position = accuracy=>({timestamp:Date.now(),coords:{latitude:41.3,longitude:69.2,accuracy}});
test("fresh GPS waits for precise fixes and clears its watcher",()=>withGPS(ok=>{ok(position(900));ok(position(12));},async count=>{
 const progress=[];const fix=await currentFix({timeout:50,onProgress:p=>progress.push(p.accuracy)});
 assert.equal(fix.accuracy,12);assert.deepEqual(progress,[900,12]);assert.equal(count(),1);
}));
test("GPS retains the best fix instead of replacing it with a worse one",()=>withGPS(ok=>{ok(position(35));ok(position(400));},async count=>{
 const fix=await currentFix({timeout:30});assert.equal(fix.accuracy,35);assert.equal(count(),1);
}));
test("GPS permission denial stops watching immediately",()=>withGPS((ok,bad)=>bad({code:1}),async count=>{
 await assert.rejects(currentFix({timeout:50}),/GPS_DENIED/);assert.equal(count(),1);
}));
test("GPS never returns an inaccurate position at timeout",()=>withGPS(ok=>ok(position(200)),async count=>{
 await assert.rejects(currentFix({timeout:30}),/GPS_INACCURATE/);assert.equal(count(),1);
}));

for (const [name,patch] of [["invalid latitude",{coords:{latitude:91,longitude:69,accuracy:5}}],
  ["invalid longitude",{coords:{latitude:41,longitude:181,accuracy:5}}],
  ["missing timestamp",{timestamp:undefined}], ["old timestamp",{timestamp:Date.now()-60000}],
  ["future timestamp",{timestamp:Date.now()+60000}]]) test(`GPS rejects ${name} before returning a fix`,()=>withGPS(ok=>ok({...position(5),...patch}),async count=>{
  await assert.rejects(currentFix({timeout:20}),/GPS_REQUIRED/);assert.equal(count(),1);
}));

test("GPS rechecks freshness when waiting for a more accurate position",()=>withGPS(ok=>ok({...position(35),timestamp:Date.now()-29990}),async count=>{
  await assert.rejects(currentFix({timeout:40}),/GPS_STALE/);assert.equal(count(),1);
}));
