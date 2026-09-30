/* SVG rendering of a graph object under a view (see state.view) */
import { pairIndex } from "./graph6.js";
import { layerValues, layerMeta, layerRange, layerRangeAll } from "./data.js";
import { showTip, hideTip } from "./ui/tooltip.js";

const NS = "http://www.w3.org/2000/svg";
export const V = 1000;            // internal SVG coordinate space

/* Graph palette from the --g-* CSS tokens (css/zoo.css), as [r,g,b].
   Cached; call resetPalette() when the theme changes.                  */
let pal = null;
const TOKENS = {
  edge:"--g-edge", edgeComplete:"--g-edge-complete", node:"--g-node",
  labelLight:"--g-label-light", labelDark:"--g-label-dark",
  edgeLow:"--g-edge-low", edgeHigh:"--g-edge-high",     // pair layers
  nodeLow:"--g-node-low", nodeHigh:"--g-node-high"      // node layers
};
function parseColor(str){
  str = str.trim();
  if(str[0] === "#"){
    const h = str.length === 4 ? str.slice(1).split("").map(c=>c+c).join("") : str.slice(1);
    return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16));
  }
  return (str.match(/[\d.]+/g) || [0,0,0]).slice(0,3).map(Number);
}
export function palette(){
  if(!pal){
    const cs = getComputedStyle(document.documentElement);
    pal = {};
    for(const k in TOKENS) pal[k] = parseColor(cs.getPropertyValue(TOKENS[k]) || "#888");
  }
  return pal;
}
export function resetPalette(){ pal = null; }
const rgb = c => "rgb("+c.join(",")+")";
/* relative luminance, for picking a readable node label */
const luma = c => (0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2]) / 255;

function project(pts){
  const xs = pts.map(p=>p[0]), ys = pts.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs);
  const minY=Math.min(...ys), maxY=Math.max(...ys);
  const w=(maxX-minX)||1, h=(maxY-minY)||1;
  const pad=130;
  const s=Math.min((V-2*pad)/w,(V-2*pad)/h);
  const ox=(V-s*w)/2, oy=(V-s*h)/2;
  return pts.map(([x,y]) => [ ox+(x-minX)*s, V-(oy+(y-minY)*s) ]); // flip y
}
function el(tag,attrs){
  const e = document.createElementNS(NS,tag);
  for(const k in attrs) e.setAttribute(k,attrs[k]);
  return e;
}
function lerp(a,b,t){ return a+(b-a)*t; }
function mixRGB(c1,c2,t){ return [0,1,2].map(i=>Math.round(lerp(c1[i],c2[i],t))); }
export function mix(c1,c2,t){ return rgb(mixRGB(c1,c2,t)); }
function title(parent, text){
  const t = document.createElementNS(NS,"title");
  t.textContent = text;
  parent.appendChild(t);
}

/* values above the layer's zero threshold (all values if it has none) */
function significant(values, name){
  const z = layerMeta(name).zeroThreshold;
  return z == null ? [...values] : [...values].filter(v=>v>z);
}

export function layerStats(values, name){
  const vals = [...values];
  const sig = significant(values, name);
  const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
  return {
    mean,
    std: Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length),
    min: sig.length ? Math.min(...sig) : 0,
    max: sig.length ? Math.max(...sig) : 0
  };
}

/* colour/width normalisation range for a layer on a graph.
   per graph: significant values of this graph — for pair layers over ALL pairs,
   not just drawn edges, so original and complete edges share one scale.
   n: the layer's range over every graph with this N.
   all: the layer's range over every graph of every N.                      */
export function layerScale(g, name, values, scale){
  if(scale === "n" || scale === "all"){
    const r = scale === "n" ? layerRange(g.N, name) : layerRangeAll(name);
    if(r) return { min:r[0], max:r[1] };
  }
  const sig = significant(values, name);
  return sig.length ? { min:Math.min(...sig), max:Math.max(...sig) } : { min:0, max:1 };
}

function normaliser({min, max}){
  const spread = max-min;
  if(spread < 1e-9) return () => 0.5;
  return v => Math.min(1, Math.max(0, (v-min)/spread));
}

/* build an <svg> element for graph g drawn under view.
   opts: { interactive:bool } */
export function renderGraph(g, view, opts){
  opts = opts || {};
  const P = palette();
  const pos = project(g.layout);
  const svg = el("svg",{ viewBox:"0 0 "+V+" "+V });
  const edges = view.edges === "complete" ? g.completeEdges : g.originalEdges;

  const EL = view.edge ? layerValues(g, view.edge) : null;
  const weighted = !!view.edge || view.edges === "complete";
  const haveW = EL?.status === "ok";
  const zero = view.edge ? layerMeta(view.edge).zeroThreshold ?? -Infinity : -Infinity;
  const short = view.edge ? (layerMeta(view.edge).short || view.edge) : "";
  const tEdge = haveW ? normaliser(layerScale(g, view.edge, EL.values, view.scale)) : null;

  const eg = el("g",{}); svg.appendChild(eg);

  for(const [a,b] of edges){
    if(!pos[a]||!pos[b]) continue;
    const [x1,y1]=pos[a], [x2,y2]=pos[b];
    const w = haveW ? EL.values[pairIndex(a,b)] : null;
    let stroke, width;

    if(haveW){
      if(w<=zero) continue;                       // zero weight → don't draw
      const t = tEdge(w);
      stroke = mix(P.edgeLow,P.edgeHigh,t);
      width  = lerp(1.5,42,t);
    } else if(weighted){
      stroke = rgb(P.edgeComplete); width = 4;       // layer pending/missing, or unweighted K_N
    } else {
      stroke = rgb(P.edge); width = 8;
    }

    const line = el("line",{
      x1,y1,x2,y2, stroke,
      "stroke-width":width, "stroke-linecap":"round",
      "stroke-opacity": weighted ? 0.92 : 1,
      "stroke-dasharray": (view.edge && !haveW) ? "2 12" : "none"
    });
    eg.appendChild(line);

    if(haveW){
      const label = "("+a+", "+b+")  "+short+" = "+w.toFixed(4);
      title(line, label);
      if(opts.interactive){
        const hit = el("line",{
          x1,y1,x2,y2, stroke:"transparent",
          "stroke-width":Math.max(width,46), "stroke-linecap":"round"
        });
        hit.style.cursor="crosshair";
        hit.addEventListener("mousemove",ev=>showTip(ev,label));
        hit.addEventListener("mouseleave",hideTip);
        eg.appendChild(hit);
      }
    }
  }

  /* nodes */
  const NL = view.node ? layerValues(g, view.node) : null;
  const haveN = NL?.status === "ok";
  const tNode = haveN ? normaliser(layerScale(g, view.node, NL.values, view.scale)) : null;
  const nshort = view.node ? (layerMeta(view.node).short || view.node) : "";

  const ng = el("g",{});
  const r = g.n>7 ? 30 : 34;
  for(let i=0;i<g.n;i++){
    const [x,y]=pos[i];
    const fill = haveN ? mixRGB(P.nodeLow,P.nodeHigh,tNode(NL.values[i])) : P.node;
    const c = el("circle",{ cx:x, cy:y, r, fill: rgb(fill),
      stroke: haveN ? rgb(P.node) : "none", "stroke-width": 4 });
    if(opts.interactive){
      title(c, "node "+i+"  ·  degree "+g.deg[i]+(haveN ? "  ·  "+nshort+" = "+NL.values[i].toFixed(4) : ""));
    }
    ng.appendChild(c);
    const lab = el("text",{
      x, y, "text-anchor":"middle", "dominant-baseline":"central",
      "font-family":"'Spline Sans Mono',ui-monospace,Menlo,Consolas,monospace",
      "font-size":(g.n>7?32:36), "font-weight":600,
      fill: rgb(luma(fill) > 0.5 ? P.labelDark : P.labelLight)
    });
    lab.textContent = i;
    ng.appendChild(lab);
  }
  svg.appendChild(ng);
  return svg;
}
