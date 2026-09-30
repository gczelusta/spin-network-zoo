import { test } from "node:test";
import assert from "node:assert/strict";
import { formatHash, readHash } from "../js/url.js";

const cat = {
  nValues: [5, 12, 13],
  count: N => ({5:1, 12:1544, 13:10778})[N],
  layers: kind => ({pair:["mi"], node:["s1"], graph:[]})[kind]
};
const plain = { edges:"original", edge:null, node:null, scale:"graph" };

test("defaults are omitted", ()=>{
  assert.equal(formatHash({ N:5, page:0, pageSize:24, view:plain, modal:null }), "N=5");
});

test("round trip of a full gallery view", ()=>{
  const view = { edges:"complete", edge:"mi", node:"s1", scale:"all" };
  const h = formatHash({ N:13, page:4, pageSize:48, view, modal:null });
  assert.equal(h, "N=13&page=5&size=48&edges=complete&w=mi&node=s1&scale=all");
  assert.deepEqual(readHash("#"+h, cat), { N:13, page:4, pageSize:48, view, modalId:null });
});

test("open graph: modal view wins, page derived from id when absent", ()=>{
  const mview = { ...plain, edge:"mi", scale:"n" };
  const h = formatHash({ N:12, page:0, pageSize:24, view:plain, modal:{ id:345, view:mview } });
  assert.equal(h, "N=12&w=mi&scale=n&g=345");
  const r = readHash(h, cat);
  assert.equal(r.modalId, 345);
  assert.equal(r.page, Math.floor(345/24));
  assert.deepEqual(r.view, mview);
});

test("invalid values fall back to defaults", ()=>{
  const r = readHash("N=99&page=-3&size=7&w=nope&node=mi&scale=huge&g=999999&edges=x", cat);
  assert.deepEqual(r, { N:5, page:0, pageSize:24, view:plain, modalId:null });
});

test("page is clamped to the last page", ()=>{
  assert.equal(readHash("N=12&page=1000", cat).page, Math.ceil(1544/24)-1);
});

test("scale is dropped when nothing is weighted", ()=>{
  assert.equal(formatHash({ N:5, page:0, pageSize:24, view:{ ...plain, scale:"all" }, modal:null }), "N=5");
});
