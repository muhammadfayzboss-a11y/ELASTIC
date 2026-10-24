import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/fixture.mjs";
import { catalog } from "../lib/catalog.mjs";
import { productArt } from "../public/product-art.js";
const password = "OnlyForAutomatedTests!27";

test("every supplied product has matching SVG art in catalog, assignments and history", () => {
  const fallback = productArt({category:"other",name_uz:"Custom item"});
  const illustrations = new Set();
  for (const p of catalog) {
    const svg = productArt(p);
    assert.notEqual(svg,fallback,p.name_uz);
    assert.equal(svg,productArt({category:p.category,name_uz:p.name_uz}),p.name_uz);
    assert.equal(svg,productArt({category:p.category,name_uz:p.name_uz.replaceAll("‘","'")}),p.name_uz);
    assert.match(svg,/^<svg .*viewBox="0 0 64 64"/);
    assert.doesNotMatch(svg,/<script|<image|href=|onload=|undefined/);
    illustrations.add(svg);
  }
  assert.equal(illustrations.size,50);
  assert.equal(productArt({category:"other",name_uz:'<script>alert(1)</script>'}),fallback);
});

test("one default invite lets multiple students create separate accounts until revoked",async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group();
  const link=await f.invite(id);
  for (const username of ["studentone","studenttwo","studentthree"]) {
    const c=new f.Client();
    await c.ok("/register","POST",{token:link.token,username,name:username,password});
    assert.deepEqual((await c.ok("/groups")).groups.map(g=>g.id),[id]);
  }
  const row=(await f.admin.ok(`/groups/${id}/invites`)).invites[0];
  assert.equal(row.max_uses,null);assert.equal(row.uses,3);
  assert.equal((await f.admin.ok(`/groups/${id}/members`)).members.length,3);
  await f.admin.ok(`/groups/${id}/invites/${link.id}`,"DELETE",{});
  const next=new f.Client();
  assert.equal((await next.request("/register","POST",{token:link.token,username:"studentfour",name:"Student Four",password})).status,410);
});

test("teacher can reuse an exhausted limited invite by removing its limit",async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group(),link=await f.invite(id,{maxUses:1});
  const one=new f.Client(),two=new f.Client();
  await one.ok("/register","POST",{token:link.token,username:"studentone",name:"Student One",password});
  assert.equal((await two.request("/register","POST",{token:link.token,username:"studenttwo",name:"Student Two",password})).status,410);
  await f.admin.ok(`/groups/${id}/invites/${link.id}/unlimit`,"POST",{});
  await two.ok("/register","POST",{token:link.token,username:"studenttwo",name:"Student Two",password});
  const row=(await f.admin.ok(`/groups/${id}/invites`)).invites[0];
  assert.equal(row.max_uses,null);assert.equal(row.uses,2);
  assert.equal((await f.admin.ok(`/groups/${id}/audit`)).events[0].action,"member_joined");
});

test("removing invite limits is teacher-scoped and cannot revive revoked, expired or archived links",async t=>{
  const f=await fixture(t,{locations:false}),id=await f.group(),other=await f.group("Other group");
  const s=await f.student(id,"studentone"),link=await f.invite(id,{maxUses:1});
  assert.equal((await s.request(`/groups/${id}/invites/${link.id}/unlimit`,"POST",{})).status,403);
  assert.equal((await f.admin.request(`/groups/${other}/invites/${link.id}/unlimit`,"POST",{})).status,404);
  await f.admin.ok(`/groups/${id}/invites/${link.id}`,"DELETE",{});
  assert.equal((await f.admin.request(`/groups/${id}/invites/${link.id}/unlimit`,"POST",{})).status,409);
  const exp=await f.invite(id,{maxUses:1,expiresAt:"2026-10-20T07:01:00Z"});
  f.setClock("2026-10-20T07:02:00Z");
  assert.equal((await f.admin.request(`/groups/${id}/invites/${exp.id}/unlimit`,"POST",{})).status,409);
  const archived=await f.invite(id,{maxUses:1});
  await f.admin.ok(`/groups/${id}/archive`,"POST",{archived:true});
  assert.equal((await f.admin.request(`/groups/${id}/invites/${archived.id}/unlimit`,"POST",{})).status,409);
});
