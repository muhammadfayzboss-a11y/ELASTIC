import test from "node:test";
import assert from "node:assert/strict";
import { currentFix, watchFix, isAppleStandalone } from "../public/location.js";
async function withGPS(run, action, synchronous = false) {
  const descriptors = Object.fromEntries(["window","navigator"].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
  let cleared=0;
  Object.defineProperty(globalThis,"window",{value:{isSecureContext:true},configurable:true});
  Object.defineProperty(globalThis,"navigator",{value:{geolocation:{watchPosition(ok,bad){if(synchronous)run(ok,bad);else queueMicrotask(()=>run(ok,bad));return 17;},clearWatch(id){assert.equal(id,17);cleared++;}}},configurable:true});
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

test("continuous GPS stops on denial and ignores later callbacks",()=>withGPS((ok,bad)=>{bad({code:1});ok(position(5));},async count=>{
 const fixes=[],errors=[];watchFix(fix=>fixes.push(fix),code=>errors.push(code));await Promise.resolve();
 assert.deepEqual(fixes,[]);assert.deepEqual(errors,['GPS_DENIED']);assert.equal(count(),1);
}));

test("a new user retry can recover after a denied GPS watch",()=>{
 let attempt=0;
 return withGPS((ok,bad)=>{if(++attempt===1)bad({code:1});else ok(position(5));},async count=>{
   const fixes=[],errors=[];watchFix(f=>fixes.push(f),e=>errors.push(e));await Promise.resolve();
   const stop=watchFix(f=>fixes.push(f),e=>errors.push(e));await Promise.resolve();
   assert.equal(fixes.length,1);assert.deepEqual(errors,['GPS_DENIED']);stop();assert.equal(count(),2);
 });
});

test("stopping a GPS watch is idempotent and prevents stale updates",()=>{
 let send;
 return withGPS(ok=>{send=ok;},async count=>{
   const fixes=[];const stop=watchFix(f=>fixes.push(f),()=>{});await Promise.resolve();stop();stop();send(position(5));
   assert.equal(fixes.length,0);assert.equal(count(),1);
 });
});

test("even synchronous permission denial clears the returned GPS watch",()=>withGPS((ok,bad)=>bad({code:1}),async count=>{
 const errors=[];watchFix(()=>{},e=>errors.push(e));assert.deepEqual(errors,['GPS_DENIED']);assert.equal(count(),1);
},true));

test("Apple standalone help is selected by its actual runtime flag",()=>withGPS(()=>{},async()=>{
 assert.equal(isAppleStandalone(),false);navigator.standalone=true;assert.equal(isAppleStandalone(),true);
 navigator.standalone=false;assert.equal(isAppleStandalone(),false);
}));

test("a transient position failure can recover without another permission request",()=>withGPS((ok,bad)=>{bad({code:2});ok(position(8));},async count=>{
 const fixes=[],errors=[];const stop=watchFix(f=>fixes.push(f),e=>errors.push(e));await Promise.resolve();
 assert.deepEqual(errors,['GPS_REQUIRED']);assert.equal(fixes.length,1);assert.equal(count(),0);stop();assert.equal(count(),1);
}));
