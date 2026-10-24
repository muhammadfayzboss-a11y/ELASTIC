import test from "node:test";
import assert from "node:assert/strict";
import { currentFix, watchFix, isAppleStandalone, selectFix, bindGpsLifecycle } from "../public/location.js";
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
  await assert.rejects(currentFix({timeout:20}),/GPS_TIMEOUT/);assert.equal(count(),1);
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
 assert.deepEqual(errors,['GPS_UNAVAILABLE']);assert.equal(fixes.length,1);assert.equal(count(),0);stop();assert.equal(count(),1);
}));

test("a coarse network fix cannot overwrite a fresh precise fix",()=>withGPS(ok=>{ok(position(10));ok(position(10560));},async count=>{
 const fixes=[];const stop=watchFix(f=>fixes.push(f),()=>{});await Promise.resolve();
 assert.deepEqual(fixes.map(f=>f.accuracy),[10]);stop();assert.equal(count(),1);
}));

test("precise movement replaces the old position even if accuracy gets slightly worse",()=>{
 const now=Date.now(), previous={latitude:41,longitude:69,accuracy:5,timestamp:now-1000};
 const next={...previous,latitude:41.01,accuracy:25,timestamp:now};
 assert.equal(selectFix(previous,next,now),next);
});

test("stale precise fixes never mask a current coarse position",()=>{
 const now=Date.now(), previous={latitude:41,longitude:69,accuracy:5,timestamp:now-30001};
 const next={...previous,accuracy:10560,timestamp:now};
 assert.equal(selectFix(previous,next,now),next);
});

test("late callbacks with older timestamps never move a user backwards",()=>{
 const now=Date.now(), previous={latitude:41,longitude:69,accuracy:20,timestamp:now};
 assert.equal(selectFix(previous,{...previous,latitude:42,accuracy:5,timestamp:now-2000},now),previous);
});

test("continuous GPS discards malformed and stale browser positions",()=>withGPS(ok=>{
 ok(null);ok({});ok({...position(5),coords:{latitude:NaN,longitude:69,accuracy:5}});
 ok({...position(5),timestamp:Date.now()-60000});ok(position(8));
},async count=>{
 const fixes=[];const stop=watchFix(f=>fixes.push(f),()=>{});await Promise.resolve();assert.equal(fixes.length,1);stop();assert.equal(count(),1);
}));

test("one-shot GPS clears its watcher even if the browser returns synchronously",()=>withGPS(ok=>ok(position(5)),async count=>{
 assert.equal((await currentFix()).accuracy,5);assert.equal(count(),1);
},true));

test("closing the location picker cancels the pending watch immediately",()=>withGPS(()=>{},async count=>{
 const controller=new AbortController(), result=currentFix({signal:controller.signal});controller.abort();
 await assert.rejects(result,/GPS_CANCELLED/);assert.equal(count(),1);
}));

test("an already cancelled GPS request never starts watching",()=>withGPS(()=>{assert.fail('watch started');},async count=>{
 const controller=new AbortController();controller.abort();
 await assert.rejects(currentFix({signal:controller.signal}),{name:'AbortError'});assert.equal(count(),0);
}));

test("a timeout is distinct from blocked permission and can recover",()=>withGPS((ok,bad)=>{bad({code:3});ok(position(9));},async count=>{
 const fixes=[],errors=[];const stop=watchFix(f=>fixes.push(f),e=>errors.push(e));await Promise.resolve();
 assert.deepEqual(errors,['GPS_TIMEOUT']);assert.equal(fixes.length,1);stop();assert.equal(count(),1);
}));

async function withControlledGPS(action) {
 const original=Object.fromEntries(['window','navigator'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const watches=[],cleared=[];
 Object.defineProperty(globalThis,'window',{value:{isSecureContext:true},configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:{geolocation:{
   watchPosition(ok,bad,options){const item={ok,bad,options,id:watches.length};watches.push(item);return item.id;},
   clearWatch(id){cleared.push(id);}
 }},configurable:true});
 try {await action(watches,cleared);} finally {for(const [key,d] of Object.entries(original)){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}}
}

test("a stalled coarse watch is restarted and precise recovery is delivered",t=>withControlledGPS(async(watches,cleared)=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const fixes=[];const stop=watchFix(f=>fixes.push(f),()=>{});
 watches[0].ok(position(10560));t.mock.timers.tick(20000);
 assert.equal(watches.length,2);assert.deepEqual(cleared,[0]);
 watches[0].ok(position(5));assert.equal(fixes.length,1,'ignore superseded watcher');
 watches[1].ok(position(7));assert.equal(fixes.at(-1).accuracy,7);
 assert.deepEqual(watches[1].options,{enableHighAccuracy:true,maximumAge:0,timeout:20000});
 stop();t.mock.timers.tick(60000);assert.equal(watches.length,2);assert.deepEqual(cleared,[0,1]);
}));

test("a stationary precise watch is refreshed before its reading expires",t=>withControlledGPS(async(watches)=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const stop=watchFix(()=>{},()=>{});watches[0].ok(position(5));t.mock.timers.tick(20000);
 assert.equal(watches.length,2);stop();
}));

test("fresh movement does not cause unnecessary watch restarts",t=>withControlledGPS(async(watches)=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const stop=watchFix(()=>{},()=>{});
 for(let i=0;i<10;i++){watches[0].ok(position(5));t.mock.timers.tick(5000);}
 assert.equal(watches.length,1);stop();
}));

test("denied location never enters the automatic retry loop",t=>withControlledGPS(async(watches,cleared)=>{
 t.mock.timers.enable({apis:['Date','setInterval'],now:1800000000000});
 const stop=watchFix(()=>{},()=>{});watches[0].bad({code:1});t.mock.timers.tick(120000);
 assert.equal(watches.length,1);assert.deepEqual(cleared,[0]);stop();
}));

test("returning from settings or screen lock resumes a user-started GPS check once",()=>{
 const doc=new EventTarget(), page=new EventTarget();doc.hidden=false;
 let active=12,suspends=0;const resumed=[];
 const unbind=bindGpsLifecycle({doc,page,active:()=>active,suspend:()=>{active=null;suspends++;},resume:id=>{resumed.push(id);active=id;}});
 page.dispatchEvent(new Event('pageshow'));assert.deepEqual(resumed,[],'never request GPS on initial load');
 doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));page.dispatchEvent(new Event('pagehide'));
 doc.hidden=false;page.dispatchEvent(new Event('pageshow'));doc.dispatchEvent(new Event('visibilitychange'));
 assert.deepEqual(resumed,[12]);assert.equal(suspends,2);
 unbind();doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(suspends,2);
});

test("a paused page without prior GPS consent never resumes GPS",()=>{
 const doc=new EventTarget(),page=new EventTarget();doc.hidden=true;let resumed=0;
 const unbind=bindGpsLifecycle({doc,page,active:()=>null,suspend:()=>{},resume:()=>resumed++});
 doc.dispatchEvent(new Event('visibilitychange'));doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));
 assert.equal(resumed,0);unbind();
});
