import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeGraph6, pairIndex, pairCount, completeEdges } from "../js/graph6.js";

test("decodes K5 (the only 4-regular graph on 5 nodes)", ()=>{
  const { n, edges } = decodeGraph6("D~{");
  assert.equal(n, 5);
  assert.equal(edges.length, 10);
});

test("zoo entries are 4-regular", ()=>{
  for(const s of ["E]~o","FFzvO","FUzro"]){
    const { n, edges } = decodeGraph6(s);
    const deg = new Array(n).fill(0);
    for(const [a,b] of edges){ deg[a]++; deg[b]++; }
    assert.deepEqual(deg, new Array(n).fill(4), s);
  }
});

test("pairIndex follows graph6 upper-triangle order", ()=>{
  const order = [];
  for(let j=1;j<6;j++) for(let i=0;i<j;i++) order.push([i,j]);
  order.forEach(([i,j],k)=>{
    assert.equal(pairIndex(i,j), k);
    assert.equal(pairIndex(j,i), k);
  });
  assert.equal(pairCount(6), order.length);
});

test("completeEdges covers every pair once", ()=>{
  const e = completeEdges(7);
  assert.equal(e.length, pairCount(7));
  assert.equal(new Set(e.map(([i,j])=>pairIndex(i,j))).size, e.length);
});
