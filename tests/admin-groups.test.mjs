import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/fixture.mjs";
import { hash } from "../lib/security.mjs";
const password="OnlyForAutomatedTests!27";
const signup = async (f,token,username) => {
  const c=new f.Client();await c.ok('/register-admin','POST',{token,username,name:username,password});return c;
};

test('deleting a group removes only its data and preserves accounts, passwords and sessions',async t=>{
  const f=await fixture(t),id=await f.group('Disposable test'),other=await f.group('Retain');
  const alice=await f.student(id,'alice'),bob=await f.student(other,'bob');
  const detail=await alice.ok(`/groups/${id}`),assigned=await alice.ok(`/groups/${id}/assign`,'POST',{productId:detail.products[0].id});
  await f.admin.ok(`/groups/${id}/schedule`,'POST',{mode:'manual',open:true});
  await alice.ok(`/groups/${id}/submissions`,'POST',f.price(assigned.id));
  await alice.ok(`/groups/${id}/assign`,'POST',{productId:detail.products[1].id,reason:'seasonal'});
  const accounts=f.app.db.prepare('SELECT * FROM users ORDER BY id').all();
  const sessions=f.app.db.prepare('SELECT * FROM sessions ORDER BY token_hash').all();
  const kept=await bob.ok(`/groups/${other}`);
  await f.admin.ok(`/groups/${id}`,'DELETE',{confirmName:'Disposable test'});
  assert.deepEqual(f.app.db.prepare('SELECT * FROM users ORDER BY id').all(),accounts);
  assert.deepEqual(f.app.db.prepare('SELECT * FROM sessions ORDER BY token_hash').all(),sessions);
  assert.deepEqual((await bob.ok(`/groups/${other}`)).products,kept.products);
  for(const table of ['memberships','group_admins','products','assignments','invites','schedules','periods','submissions','product_change_requests','store_locations','audit_events'])assert.equal(f.app.db.prepare(`SELECT COUNT(*) n FROM ${table} WHERE group_id=?`).get(id).n,0,table);
  assert.equal(f.app.db.prepare('SELECT COUNT(*) n FROM price_revisions').get().n,0);
  assert.equal(f.app.db.prepare('SELECT COUNT(*) n FROM store_observations').get().n,0);
  assert.deepEqual(f.app.db.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal((await alice.ok('/session')).user.username,'alice');
});

test('group deletion needs its teacher and exact name; unrelated admins and students cannot delete it',async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group('Private group'),s=await f.student(id,'alice');
  const link=await f.admin.ok('/admin-invites','POST',{}),other=await signup(f,link.token,'otherteacher');
  assert.equal((await s.request(`/groups/${id}`,'DELETE',{confirmName:'Private group'})).status,403);
  assert.equal((await other.request(`/groups/${id}`,'DELETE',{confirmName:'Private group'})).status,403);
  assert.equal((await f.admin.request(`/groups/${id}`,'DELETE',{confirmName:'wrong'})).error,'GROUP_NAME_REQUIRED');
  assert.equal((await f.admin.ok(`/groups/${id}`)).products.length,50);
});

test('deleted group IDs are never reused and its old invitation stops working',async t=>{
  const f=await fixture(t),id=await f.group('Old test'),link=await f.invite(id);
  await f.admin.ok(`/groups/${id}`,'DELETE',{confirmName:'Old test'});
  assert.equal((await f.admin.request(`/groups/${id}`)).status,404);
  assert.equal((await f.admin.request(`/groups/${id}/archive`,'POST',{archived:false})).status,404);
  const next=await f.group('New group');assert.ok(next>id);
  assert.deepEqual((await f.admin.ok('/groups')).groups.map(g=>g.id),[next]);
  const anonymous=new f.Client();assert.equal((await anonymous.request('/invites/inspect','POST',{token:link.token})).status,410);
});

test('one admin invite creates multiple independent teacher accounts without revealing existing groups',async t=>{
  const f=await fixture(t),id=await f.group('Original teacher group');
  const link=await f.admin.ok('/admin-invites','POST',{});
  const first=await signup(f,link.token,'teacherone'),second=await signup(f,link.token,'teachertwo');
  for(const c of [first,second]){
    assert.equal(c.user.role,'admin');assert.deepEqual((await c.ok('/groups')).groups,[]);
    assert.equal((await c.request(`/groups/${id}`)).status,403);
    await c.ok('/groups','POST',{name:'Own class'});
  }
  const listed=(await f.admin.ok('/admin-invites')).invites[0];assert.equal(listed.uses,2);
  assert.equal(listed.token_hash,undefined);assert.equal(listed.token,undefined);
  assert.notEqual(f.app.db.prepare('SELECT token_hash FROM admin_invites').get().token_hash,link.token);
});

test('admin invite management is authenticated, creator-scoped and cannot be used after revocation',async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group(),s=await f.student(id,'alice'),anon=new f.Client();
  assert.equal((await anon.request('/admin-invites')).status,401);
  for(const method of ['GET','POST'])assert.equal((await s.request('/admin-invites',method,method==='POST'?{}:undefined)).status,403);
  const link=await f.admin.ok('/admin-invites','POST',{}),other=await signup(f,link.token,'teacherone');
  assert.equal((await s.request(`/admin-invites/${link.id}`,'DELETE',{})).status,403);
  assert.equal((await other.request(`/admin-invites/${link.id}`,'DELETE',{})).status,404);
  await f.admin.ok(`/admin-invites/${link.id}`,'DELETE',{});
  assert.equal((await anon.request('/admin-invites/inspect','POST',{token:link.token})).status,410);
  assert.equal((await anon.request('/register-admin','POST',{token:link.token,username:'teacherafter',name:'Teacher After',password})).status,410);
});

test('admin registration never promotes or overwrites an existing account',async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group(),s=await f.student(id,'alice'),link=await f.admin.ok('/admin-invites','POST',{});
  const before=f.app.db.prepare('SELECT * FROM users ORDER BY id').all();
  assert.equal((await s.request('/register-admin','POST',{token:link.token,username:'alice',name:'New name',password})).error,'SIGN_OUT_FIRST');
  const anon=new f.Client();
  assert.equal((await anon.request('/register-admin','POST',{token:link.token,username:'alice',name:'New name',password})).error,'USERNAME_TAKEN');
  assert.equal((await anon.request('/register-admin','POST',{token:link.token,username:'newteacher',name:'New Teacher',password:'short'})).error,'PASSWORD_LENGTH');
  const studentLink=await f.invite(id);
  assert.equal((await anon.request('/register-admin','POST',{token:studentLink.token,username:'newteacher',name:'New Teacher',password})).status,410);
  assert.deepEqual(f.app.db.prepare('SELECT * FROM users ORDER BY id').all(),before);
  assert.equal(f.app.db.prepare('SELECT uses FROM admin_invites WHERE token_hash=?').get(hash(link.token)).uses,0);
});

test('concurrent signups with the same username create one admin and consume one invite use',async t=>{
  const f=await fixture(t),link=await f.admin.ok('/admin-invites','POST',{}),a=new f.Client(),b=new f.Client();
  const body={token:link.token,username:'sameadmin',name:'Same Admin',password};
  const results=await Promise.all([a.request('/register-admin','POST',body),b.request('/register-admin','POST',body)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  assert.equal((await f.admin.ok('/admin-invites')).invites[0].uses,1);
});
