import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/fixture.mjs";

test("home screen metadata uses a stable ELASTIC name on iPhone and Android", async t => {
  const {origin}=await fixture(t);
  const html=await (await fetch(origin)).text();
  assert.match(html,/<meta name="apple-mobile-web-app-title" content="ELASTIC">/);
  assert.match(html,/<meta name="application-name" content="ELASTIC">/);
  assert.match(html,/<link rel="apple-touch-icon" sizes="180x180" href="\/apple-touch-icon.png\?v=1">/);
  assert.match(html,/<link rel="manifest" href="\/manifest.webmanifest">/);
  const response=await fetch(origin+'/manifest.webmanifest');
  assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/manifest\+json/);
  const manifest=await response.json();
  assert.equal(manifest.name,'ELASTIC');assert.equal(manifest.short_name,'ELASTIC');
  assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.start_url,'/#overview');
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.some(icon=>icon.purpose==='maskable'&&icon.sizes==='512x512'));
});

test("linked install icons are public PNGs with matching sizes and support HEAD", async t=>{
  const {origin}=await fixture(t);
  const manifest=await (await fetch(origin+'/manifest.webmanifest')).json();
  for (const icon of [{src:'/apple-touch-icon.png?v=1',sizes:'180x180'},...manifest.icons]) {
    const response=await fetch(new URL(icon.src,origin));
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/png');
    const bytes=Buffer.from(await response.arrayBuffer());
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    const [width,height]=icon.sizes.split('x').map(Number);
    assert.equal(bytes.readUInt32BE(16),width);assert.equal(bytes.readUInt32BE(20),height);
    assert.equal(bytes[25],2,'Home screen icons are opaque RGB');
    const head=await fetch(new URL(icon.src,origin),{method:'HEAD'});
    assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
  }
  assert.equal((await fetch(origin+'/icons/not-allowed.png')).status,404);
});
