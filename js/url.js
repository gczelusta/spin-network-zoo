/* Permalinks: the view lives in the URL hash, e.g.
     #N=12&page=3&edges=complete&w=mi&node=s1&scale=n&g=345
   Defaults are omitted. page is 1-based. When a graph is open (g=…), the view
   keys describe the modal's view, and restoring applies them to the gallery too.
   Pure functions, no DOM — testable under node.                                */

const DEFAULT_SIZE = 24;
export const PAGE_SIZES = [12, 24, 48, 96];
const SCALES = ["graph", "n", "all"];

/* { N, page, pageSize, view, modal:{id, view}|null } → "N=…&…" */
export function formatHash({ N, page, pageSize, view, modal }){
  const v = modal ? modal.view : view;
  const p = new URLSearchParams();
  p.set("N", N);
  if(page > 0) p.set("page", page+1);
  if(pageSize !== DEFAULT_SIZE) p.set("size", pageSize);
  if(v.edges === "complete") p.set("edges", "complete");
  if(v.edge) p.set("w", v.edge);
  if(v.node) p.set("node", v.node);
  if(v.scale !== "graph" && (v.edge || v.node)) p.set("scale", v.scale);
  if(modal) p.set("g", modal.id);
  return p.toString();
}

/* Parse and validate a hash against the catalogue.
   cat: { nValues:number[], count(N):number, layers(kind):string[] }
   → { N, page, pageSize, view, modalId|null }; anything invalid falls back to defaults */
export function readHash(hash, cat){
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const int = k => { const v = parseInt(p.get(k), 10); return Number.isFinite(v) ? v : null; };

  const N = cat.nValues.includes(int("N")) ? int("N") : cat.nValues[0];
  const count = cat.count(N);
  const pageSize = PAGE_SIZES.includes(int("size")) ? int("size") : DEFAULT_SIZE;
  const pages = Math.max(1, Math.ceil(count / pageSize));

  let modalId = int("g");
  if(modalId === null || modalId < 0 || modalId >= count) modalId = null;

  let page = (int("page") ?? 1) - 1;
  if(modalId !== null && p.get("page") === null) page = Math.floor(modalId / pageSize);
  page = Math.min(Math.max(page, 0), pages-1);

  const pick = (key, kind) => cat.layers(kind).includes(p.get(key)) ? p.get(key) : null;
  const view = {
    edges: p.get("edges") === "complete" ? "complete" : "original",
    edge: pick("w", "pair"),
    node: pick("node", "node"),
    scale: SCALES.includes(p.get("scale")) ? p.get("scale") : "graph"
  };
  return { N, page, pageSize, view, modalId };
}
