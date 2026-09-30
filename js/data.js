/* Data access over the sharded format written by tools/pack.py.

   data/manifest.json          counts per N, which layers exist, layer metadata
   data/N{N}/graphs-{k}.txt    graph6 strings for ids k*S .. k*S+S-1
   data/N{N}/layout-{k}.bin    int16, n*2 per graph (scaled by layoutScale)
   data/N{N}/{layer}-{k}.bin   float32, fixed width per graph, NaN = missing

   Shards are fetched on demand; the cache stores the in-flight Promise so
   concurrent callers share one request, and keeps at most MAX_SHARDS
   settled shards (least recently used are dropped).                        */
import { decodeGraph6, circularLayout, completeEdges, pairCount } from "./graph6.js";

export const DATA_DIR = "data";
const MAX_SHARDS = 64;
const MAX_GRAPHS = 4000;
const LAYOUT_MISSING = -32768;

let manifest = null;
const shardCache = new Map();    // "N/kind/k" → { promise, value }  (value undefined while pending, null on failure)
const graphCache = new Map();    // "N-id" → graph object (static parts only)
const listeners  = [];

export function onShardLoaded(cb){ listeners.push(cb); }

export async function loadManifest(){
  const res = await fetch(DATA_DIR+"/manifest.json");
  if(!res.ok) throw new Error(res.status);
  manifest = await res.json();
  return manifest;
}

/* sorted N values and graph counts */
export function nValues(){ return Object.keys(manifest.N).map(Number).sort((a,b)=>a-b); }
export function graphCount(N){ return manifest.N[N]?.count ?? 0; }
export function layerMeta(name){ return manifest.layers[name]; }
export function hasLayer(N, name){ return !!manifest.N[N]?.layers.includes(name); }
/* observable layers (optionally of one kind: pair | node | graph), manifest order */
export function layerNames(kind){
  return Object.keys(manifest.layers).filter(l => !kind || manifest.layers[l].kind === kind);
}
/* [min,max] of a layer over all graphs with N nodes, or null */
export function layerRange(N, name){ return manifest.layers[name]?.range?.[N] ?? null; }
/* [min,max] of a layer over every N that has it, or null */
export function layerRangeAll(name){
  const rs = Object.values(manifest.layers[name]?.range ?? {});
  return rs.length ? [Math.min(...rs.map(r=>r[0])), Math.max(...rs.map(r=>r[1]))] : null;
}

function layerWidth(kind, n){
  return kind === "pair" ? pairCount(n) : kind === "node" ? n : 1;
}

function parseShard(kind, res){
  if(kind === "graphs") return res.text().then(t => t.split("\n"));
  return res.arrayBuffer().then(buf => kind === "layout" ? new Int16Array(buf) : new Float32Array(buf));
}

function shard(N, kind, k){
  const key = N+"/"+kind+"/"+k;
  let e = shardCache.get(key);
  if(e){ shardCache.delete(key); shardCache.set(key, e); return e; }   // LRU touch
  e = { value: undefined };
  e.promise = fetch(DATA_DIR+"/N"+N+"/"+kind+"-"+k+(kind==="graphs" ? ".txt" : ".bin"))
    .then(r => r.ok ? parseShard(kind, r) : null)
    .catch(() => null)
    .then(v => {
      e.value = v;
      if(kind !== "graphs" && kind !== "layout") for(const cb of listeners) cb(N, kind);
      return v;
    });
  shardCache.set(key, e);
  evict(shardCache, MAX_SHARDS, x => x.value !== undefined);
  return e;
}

function evict(map, max, canDrop = () => true){
  for(const [key, v] of map){
    if(map.size <= max) break;
    if(canDrop(v)) map.delete(key);
  }
}

export async function loadGraph(N, id){
  const key = N+"-"+id;
  if(graphCache.has(key)) return graphCache.get(key);

  const S = manifest.shardSize, k = Math.floor(id/S), r = id%S;
  const [lines, lay] = await Promise.all([
    shard(N, "graphs", k).promise,
    hasLayer(N, "layout") ? shard(N, "layout", k).promise : null
  ]);
  const graph6 = lines?.[r];
  if(!graph6) throw new Error("no graph "+key);
  const dec = decodeGraph6(graph6);
  const n = dec.n;

  let layout = null;
  if(lay && lay[r*2*n] !== LAYOUT_MISSING){
    const sc = manifest.N[N].layoutScale / 32767;
    layout = [];
    for(let i=0;i<n;i++) layout.push([lay[(r*n+i)*2]*sc, lay[(r*n+i)*2+1]*sc]);
  }

  const deg = new Array(n).fill(0);
  for(const [a,b] of dec.edges){ deg[a]++; deg[b]++; }

  const g = {
    N, id, graph6, n,
    originalEdges: dec.edges,
    completeEdges: completeEdges(n),
    layout: layout || circularLayout(n),
    hasLayout: !!layout,
    deg
  };
  if(graphCache.has(key)) return graphCache.get(key);   // lost a race
  graphCache.set(key, g);
  evict(graphCache, MAX_GRAPHS);
  return g;
}

/* Values of an observable layer for a graph. Starts the shard fetch if needed.
   → { status:"ok", values }   values: Float32Array view (pair layers in graph6 pair order)
     { status:"pending" }      shard still loading — onShardLoaded fires when it lands
     { status:"missing" }      this N has the layer but not this graph (or the fetch failed)
     { status:"absent" }       no such layer for this N                                  */
export function layerValues(g, name){
  if(!hasLayer(g.N, name)) return { status:"absent" };
  const S = manifest.shardSize;
  const e = shard(g.N, name, Math.floor(g.id/S));
  if(e.value === undefined) return { status:"pending" };
  if(e.value === null) return { status:"missing" };
  const w = layerWidth(manifest.layers[name].kind, g.n), off = (g.id%S)*w;
  const values = e.value.subarray(off, off+w);
  if(values.length < w || Number.isNaN(values[0])) return { status:"missing" };
  return { status:"ok", values };
}

/* resolves when the layer shard for (N,id) has settled */
export function layerReady(N, id, name){
  if(!hasLayer(N, name)) return Promise.resolve();
  return shard(N, name, Math.floor(id/manifest.shardSize)).promise;
}
