/* Data access: catalogue, per-N layout/MI files, per-graph objects.
   Layout and MI are fetched once per N (not per graph). The caches store
   Promises so concurrent requests share one fetch.                        */
import { decodeGraph6, circularLayout, completeEdges } from "./graph6.js";

export const DATA_DIR = "data";

const graphCache   = new Map();   // "N-id" → graph object
const nLayoutCache = new Map();   // N → Promise<Array|null>
const nMICache     = new Map();   // N → Promise<Array|null>
const nMIDone      = new Set();   // N values where MI fetch has settled
const miListeners  = [];

export function onMILoaded(cb){ miListeners.push(cb); }
export function miSettled(N){ return nMIDone.has(N); }
export function cachedGraph(N, id){ return graphCache.get(N+"-"+id); }

export function parseCSV(text){
  const lines = text.trim().split(/\r?\n/);
  const out = [];
  for(let i=1;i<lines.length;i++){
    const ln = lines[i].trim();
    if(!ln) continue;
    const p = ln.split(",");
    out.push({ N:parseInt(p[0],10), id:parseInt(p[1],10), graph6:(p[2]||"").trim() });
  }
  return out;
}

/* → Map N → records sorted by id */
export async function loadCatalogue(){
  const res = await fetch(DATA_DIR+"/zoo.csv");
  if(!res.ok) throw new Error(res.status);
  const byN = new Map();
  for(const r of parseCSV(await res.text())){
    if(!byN.has(r.N)) byN.set(r.N,[]);
    byN.get(r.N).push(r);
  }
  for(const list of byN.values()) list.sort((a,b)=>a.id-b.id);
  return byN;
}

function fetchJSON(url){
  return fetch(url).then(r => r.ok ? r.json() : null).catch(()=>null);
}

export function getNLayout(N){
  if(!nLayoutCache.has(N)) nLayoutCache.set(N, fetchJSON(DATA_DIR+"/layout_N"+N+".json"));
  return nLayoutCache.get(N);
}

export function getNMI(N){
  if(!nMICache.has(N)){
    nMICache.set(N, fetchJSON(DATA_DIR+"/mi_N"+N+".json").then(data=>{
      nMIDone.add(N);
      applyMI(N, data);
      return data;
    }));
  }
  return nMICache.get(N);
}

/* MI data for N arrived — patch cached graph objects in place, then notify */
function applyMI(N, miData){
  if(!miData) return;
  for(const g of graphCache.values()){
    if(g.N !== N || g.has.mi) continue;
    const entry = miData[g.id];
    if(Array.isArray(entry)){ g.mi = entry; g.has.mi = true; }
  }
  for(const cb of miListeners) cb(N);
}

export async function loadGraph(rec){
  const key = rec.N+"-"+rec.id;
  if(graphCache.has(key)) return graphCache.get(key);

  const dec = decodeGraph6(rec.graph6);
  const n = dec.n;

  const layoutData  = await getNLayout(rec.N);
  const layoutEntry = layoutData?.[rec.id] ?? null;

  /* MI: use cached result if already fetched, otherwise don't block */
  const miData  = nMICache.has(rec.N) ? await nMICache.get(rec.N) : null;
  const miEntry = miData?.[rec.id];

  const deg = new Array(n).fill(0);
  for(const [a,b] of dec.edges){ deg[a]++; deg[b]++; }

  const g = {
    N:rec.N, id:rec.id, graph6:rec.graph6, n,
    originalEdges: dec.edges,
    completeEdges: completeEdges(n),
    layout: Array.isArray(layoutEntry) ? layoutEntry : circularLayout(n),
    mi:     Array.isArray(miEntry) ? miEntry : null,   // flat, graph6 pair order
    has:{ layout: Array.isArray(layoutEntry), mi: Array.isArray(miEntry) },
    deg
  };
  if(graphCache.has(key)) return graphCache.get(key);   // lost a race
  graphCache.set(key, g);
  return g;
}
