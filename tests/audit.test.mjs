import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './helpers/fixture.mjs';
import { coordinates, distanceMeters, locationError } from '../public/geo.js';
import { windowFor, localDate } from '../lib/schedule.mjs';
import { messages } from '../public/i18n.js';
import { clientAddress } from '../lib/security.mjs';

async function ready(t) {
  const f = await fixture(t), id = await f.group();
  const alice = await f.student(id, 'alice'), detail = await alice.ok(`/groups/${id}`);
  const assignment = await alice.ok(`/groups/${id}/assign`, 'POST', {productId:detail.products[0].id});
  await f.admin.ok(`/groups/${id}/schedule`, 'POST', {mode:'manual',open:true});
  return {...f,id,alice,assignment,products:detail.products, payload:f.price(assignment.id)};
}

test('audit: approved product change must require prices for the new assignment', async t => {
  const f=await ready(t);
  await f.alice.ok(`/groups/${f.id}/submissions`,'POST',f.payload);
  const change=await f.alice.ok(`/groups/${f.id}/assign`,'POST',{productId:f.products[1].id,reason:'seasonal'});
  await f.admin.ok(`/groups/${f.id}/changes/${change.requestId}/approve`,'POST',{});
  const member=(await f.admin.ok(`/groups/${f.id}/members`)).members[0];
  assert.equal(member.submitted,false);
  assert.deepEqual(member.collectedStores,[]);
  assert.equal((await f.admin.ok('/groups')).groups[0].submitted,0);
  assert.equal((await f.alice.ok(`/groups/${f.id}/history`)).records.length,1);
});

test('audit: legacy completed prices remain complete after a single store correction',async t=>{
  const f=await ready(t);
  await f.alice.ok(`/groups/${f.id}/submissions`,'POST',f.payload);
  f.app.db.exec('DELETE FROM store_observations'); // Existing pre-GPS history.
  await f.alice.ok(`/groups/${f.id}/submissions`,'POST',{...f.payload,storeKey:'korzinka',korzinka:17000});
  assert.equal((await f.alice.ok(`/groups/${f.id}`)).collectedStores.length,3);
  assert.equal((await f.admin.ok(`/groups/${f.id}/members`)).members[0].submitted,true);
  assert.equal((await f.admin.ok('/groups')).groups[0].submitted,1);
});

test('audit: old approved locations remain available after many rejected proposals',async t=>{
  const f=await ready(t);
  const insert=f.app.db.prepare("INSERT INTO store_locations(group_id,user_id,store_key,name,brand,latitude,longitude,status,requested_at) VALUES(?,?,'local','Rejected','local',41,69,'rejected','2026-10-20T07:00:00.000Z')");
  for(let i=0;i<305;i++)insert.run(f.id,f.alice.user.id);
  const detail=await f.alice.ok(`/groups/${f.id}`);
  assert.equal(detail.locations.filter(p=>p.status==='approved').length,3);
});

for(const page of ['1.01','1.5','-1','0','Infinity','abc']) test(`audit: history rejects invalid page ${page}`,async t=>{
  const f=await fixture(t),id=await f.group();
  assert.equal((await f.admin.request(`/groups/${id}/history?page=${page}`)).status,400);
});

for(const [param,value] of [['from','2026-02-30'],['to','2026-13-01'],['from','not-a-date'],['category','invalid']])test(`audit: history rejects invalid ${param}=${value}`,async t=>{
  const f=await fixture(t),id=await f.group();
  assert.equal((await f.admin.request(`/groups/${id}/history?${param}=${value}`)).status,400);
});

const now='2026-10-20T07:00:00.000Z',point={latitude:41.3111,longitude:69.2797};
const fix={...point,accuracy:5,timestamp:Date.parse(now)};
for(const [name,change,error] of [
 ['missing latitude',{latitude:undefined},'GPS_REQUIRED'],['string latitude',{latitude:'41'},'GPS_REQUIRED'],
 ['north overflow',{latitude:90.01},'GPS_REQUIRED'],['south overflow',{latitude:-90.01},'GPS_REQUIRED'],
 ['longitude overflow',{longitude:180.01},'GPS_REQUIRED'],['west overflow',{longitude:-180.01},'GPS_REQUIRED'],
 ['NaN latitude',{latitude:NaN},'GPS_REQUIRED'],['infinite longitude',{longitude:Infinity},'GPS_REQUIRED'],
 ['zero accuracy',{accuracy:0},'GPS_REQUIRED'],['negative accuracy',{accuracy:-1},'GPS_REQUIRED'],
 ['string accuracy',{accuracy:'5'},'GPS_REQUIRED'],['NaN accuracy',{accuracy:NaN},'GPS_REQUIRED'],
 ['50m accuracy',{accuracy:50},null],['over 50m accuracy',{accuracy:50.01},'GPS_INACCURATE'],
 ['missing timestamp',{timestamp:undefined},'GPS_REQUIRED'],['string timestamp',{timestamp:now},'GPS_REQUIRED'],
 ['NaN timestamp',{timestamp:NaN},'GPS_REQUIRED'],['30s old',{timestamp:fix.timestamp-30000},null],
 ['over 30s old',{timestamp:fix.timestamp-30001},'GPS_STALE'],['5s future',{timestamp:fix.timestamp+5000},null],
 ['over 5s future',{timestamp:fix.timestamp+5001},'GPS_STALE'],['fresh fix',{},null]
])test(`audit GPS: ${name}`,()=>assert.equal(locationError({...fix,...change},point,now),error));

for(const metres of [0,1,50,99,99.99,100.01,101,150,500,1000])test(`audit radius: ${metres} metres`,()=>{
 const origin={latitude:0,longitude:0},p={...fix,latitude:metres/6371008.8*180/Math.PI,longitude:0};
 assert.ok(Math.abs(distanceMeters(origin,p)-metres)<0.000001);
 assert.equal(locationError(p,origin,now),metres<=100?null:'GPS_OUTSIDE');
});

for(const weekday of [0,1,2,3,4,5,6])for(const offset of [-1,0,60*60000])test(`audit schedule: weekday ${weekday}, boundary ${offset}`,()=>{
 const start=Date.parse('2026-10-18T03:00:00Z')+weekday*86400000;
 const w=windowFor({mode:'weekly',revision:4,weekday,minute:480,duration_minutes:60},new Date(start+offset));
 assert.equal(w.open,offset===0);assert.ok(w.key.startsWith('4:weekly:'));
 if(offset===0)assert.equal(w.start,new Date(start).toISOString());
});

for(const [utc,expected] of [['2026-10-20T18:59:59Z','2026-10-20'],['2026-10-20T19:00:00Z','2026-10-21'],['2026-12-31T19:00:00Z','2027-01-01'],['2028-02-28T19:00:00Z','2028-02-29']])test(`audit Tashkent date: ${utc}`,()=>assert.equal(localDate(utc),expected));

const adminRoutes=[['members','GET'],['invites','GET'],['audit','GET'],['archive','POST',{archived:true}],['products','POST',{productKeys:[]}],['products/1','DELETE',{}],['schedule','POST',{mode:'manual',open:true}],['invites','POST',{}],['invites/1','DELETE',{}],['members/1/remove','POST',{}],['members/1/password','POST',{password:'AnotherPassword123'}],['changes/1/approve','POST',{}],['changes/1/reject','POST',{}],['locations/1/approve','POST',{}],['locations/1/reject','POST',{}]];
for(const [route,method,data] of adminRoutes)test(`audit permission: student cannot ${method} ${route}`,async t=>{
 const f=await fixture(t,{locations:false}),id=await f.group(),s=await f.student(id,'alice');
 assert.equal((await s.request(`/groups/${id}/${route}`,method,data)).status,403);
});
for(const route of ['','members','history','assignments','export','audit','invites'])test(`audit isolation: outsider cannot read group ${route||'detail'}`,async t=>{
 const f=await fixture(t,{locations:false}),id=await f.group(),other=await f.group(),s=await f.student(other,'outsider');
 assert.equal((await s.request(`/groups/${id}${route?'/'+route:''}`)).status,403);
});

for(const [label,value] of [['zero',0],['negative',-1],['too large',100000001],['three decimals',1.001],['string','100'],['boolean',true],['array',[]],['object',{}],['missing',undefined]])test(`audit price validation: ${label}`,async t=>{
 const f=await ready(t),before=f.app.db.prepare('SELECT COUNT(*) n FROM price_revisions').get().n;
 assert.equal((await f.alice.request(`/groups/${f.id}/submissions`,'POST',{...f.payload,storeKey:'korzinka',korzinka:value})).status,400);
 assert.equal(f.app.db.prepare('SELECT COUNT(*) n FROM price_revisions').get().n,before);
});
for(const value of [null,0.01,1.23,100000000])test(`audit valid price: ${value}`,async t=>{
 const f=await ready(t);await f.alice.ok(`/groups/${f.id}/submissions`,'POST',{...f.payload,storeKey:'korzinka',korzinka:value});
 assert.equal((await f.alice.ok(`/groups/${f.id}`)).latest.korzinka,value===null?null:Math.round(value*100));
});

for(const patch of [{latitude:91},{latitude:-91},{longitude:181},{longitude:-181},{latitude:'41'},{longitude:null},{storeKey:'unknown'},{name:''},{name:'x'.repeat(101)},{storeKey:'secondary',brand:'Other'}])test(`audit location validation: ${JSON.stringify(patch)}`,async t=>{
 const f=await fixture(t,{locations:false}),id=await f.group(),s=await f.student(id,'alice');
 assert.equal((await s.request(`/groups/${id}/locations`,'POST',{...point,storeKey:'local',name:'Shop',...patch})).status,400);
});

for(const patch of [{weekday:-1},{weekday:7},{weekday:1.5},{minute:-1},{minute:1440},{minute:'480'},{durationMinutes:0},{durationMinutes:10081},{durationMinutes:1.5},{mode:'bad'}])test(`audit schedule validation: ${JSON.stringify(patch)}`,async t=>{
 const f=await fixture(t),id=await f.group();const before=(await f.admin.ok(`/groups/${id}`)).schedule;
 assert.equal((await f.admin.request(`/groups/${id}/schedule`,'POST',{mode:'weekly',weekday:1,minute:480,durationMinutes:60,...patch})).status,400);
 assert.deepEqual((await f.admin.ok(`/groups/${id}`)).schedule,before);
});

for(const path of ['/','.env','/data/micro.sqlite','/backups/test.sqlite','/lib/app.mjs','/server.mjs','/package.json','/vendor/leaflet.js','/geo.js','/healthz'])test(`audit static boundary: ${path}`,async t=>{
 const f=await fixture(t),p=path.startsWith('/')?path:'/'+path;
 const res=await fetch(f.origin+p);assert.equal(res.status,['/','/vendor/leaflet.js','/geo.js','/healthz'].includes(p)?200:404);
 assert.equal(res.headers.get('x-content-type-options'),'nosniff');
});

for(const lang of ['uz','en','ru'])test(`audit translation coverage: ${lang}`,()=>{
 assert.deepEqual(Object.keys(messages[lang]).sort(),Object.keys(messages.en).sort());
 for(const [key,value]of Object.entries(messages[lang]))assert.equal(typeof value,'string',key);
});

test('audit: concurrent revisions retain every submitted price',async t=>{
 const f=await ready(t);const values=[100,200,300,400,500];
 const saved=await Promise.all(values.map(korzinka=>f.alice.ok(`/groups/${f.id}/submissions`,'POST',{...f.payload,storeKey:'korzinka',korzinka})));
 assert.deepEqual(saved.map(r=>r.version).sort(),[1,2,3,4,5]);
 const h=await f.alice.ok(`/groups/${f.id}/history`);assert.equal(h.records[0].revisions.length,5);
 assert.deepEqual(h.records[0].revisions.map(r=>r.korzinka).sort((a,b)=>a-b),values.map(v=>v*100));
});

test('audit: rejected location cannot replace the approved store',async t=>{
 const f=await ready(t),before=(await f.alice.ok(`/groups/${f.id}`)).locations.find(p=>p.store_key==='local'&&p.status==='approved');
 const p=await f.alice.ok(`/groups/${f.id}/locations`,'POST',{storeKey:'local',name:'Replacement',latitude:42,longitude:70});
 await f.admin.ok(`/groups/${f.id}/locations/${p.id}/reject`,'POST',{});
 assert.equal((await f.alice.ok(`/groups/${f.id}`)).locations.find(p=>p.store_key==='local'&&p.status==='approved').id,before.id);
});

test('audit: repeated manual open preserves the current submission period',async t=>{
 const f=await ready(t);await f.alice.ok(`/groups/${f.id}/submissions`,'POST',f.payload);
 const before=(await f.alice.ok(`/groups/${f.id}`)).window.key;
 await f.admin.ok(`/groups/${f.id}/schedule`,'POST',{mode:'manual',open:true});
 assert.equal((await f.alice.ok(`/groups/${f.id}`)).window.key,before);
 assert.equal((await f.admin.ok(`/groups/${f.id}/members`)).members[0].submitted,true);
});

for(const [remote,header,trust,expected] of [
 ['127.0.0.1','192.0.2.1',true,'192.0.2.1'],['::1','2001:db8::1',true,'2001:db8::1'],
 ['::ffff:127.0.0.1','192.0.2.2',true,'192.0.2.2'],['127.0.0.1','192.0.2.1',false,'127.0.0.1'],
 ['198.51.100.1','192.0.2.1',true,'198.51.100.1'],['127.0.0.1','fake',true,'127.0.0.1'],
 ['127.0.0.1','192.0.2.1, 192.0.2.2',true,'127.0.0.1'],['127.0.0.1',undefined,true,'127.0.0.1']
])test(`audit proxy: ${remote} / ${header} / trust=${trust}`,()=>{
 assert.equal(clientAddress({socket:{remoteAddress:remote},headers:{'x-real-ip':header}},trust),expected);
});

test('audit: partial history distinguishes unvisited stores from unavailable products',async t=>{
 const f=await ready(t);await f.alice.ok(`/groups/${f.id}/submissions`,'POST',{...f.payload,storeKey:'korzinka',korzinka:null});
 const record=(await f.alice.ok(`/groups/${f.id}/history`)).records[0];
 assert.deepEqual(record.collectedStores,['korzinka']);assert.equal(record.korzinka,null);assert.equal(record.local,null);
});

test('audit: reversed history dates are rejected',async t=>{
 const f=await fixture(t),id=await f.group();
 assert.equal((await f.admin.request(`/groups/${id}/history?from=2026-10-21&to=2026-10-20`)).status,400);
});

test('audit: removing a member closes pending requests and clears the teacher inbox',async t=>{
 const f=await ready(t);
 const change=await f.alice.ok(`/groups/${f.id}/assign`,'POST',{productId:f.products[1].id,reason:'seasonal'});
 const place=await f.alice.ok(`/groups/${f.id}/locations`,'POST',{storeKey:'local',name:'Pending store',...point});
 assert.equal((await f.admin.ok('/groups')).groups[0].pendingRequests,2);
 await f.admin.ok(`/groups/${f.id}/members/${f.alice.user.id}/remove`,'POST',{});
 assert.equal((await f.admin.ok('/groups')).groups[0].pendingRequests,0);
 const detail=await f.admin.ok(`/groups/${f.id}`);assert.deepEqual(detail.changeRequests,[]);assert.deepEqual(detail.locations,[]);
 assert.equal(f.app.db.prepare('SELECT status FROM product_change_requests WHERE id=?').get(change.requestId).status,'cancelled');
 assert.equal(f.app.db.prepare('SELECT status FROM store_locations WHERE id=?').get(place.id).status,'superseded');
});
