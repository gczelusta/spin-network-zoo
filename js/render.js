/* SVG rendering of a graph object */
import { pairIndex } from "./graph6.js";
import { showTip, hideTip } from "./ui/tooltip.js";

const NS = "http://www.w3.org/2000/svg";
export const V = 1000;            // internal SVG coordinate space
const COL = {
  edgeOriginal:"#33302b", edgeComplete:"#b9ad97",
  node:"#272320", nodeLabel:"#f5f1e6",
  miLow:[196,214,207], miHigh:[14,82,75]
};
const ZERO = 1e-10;               // MI at or below this is treated as zero

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
function mix(c1,c2,t){
  return "rgb("+Math.round(lerp(c1[0],c2[0],t))+","
    +Math.round(lerp(c1[1],c2[1],t))+","
    +Math.round(lerp(c1[2],c2[2],t))+")";
}

/* nonzero values of a flat per-pair array, with min/max */
export function nonzeroStats(values){
  const vals = values ? values.filter(v=>v>ZERO) : [];
  return {
    vals,
    min: vals.length ? Math.min(...vals) : 0,
    max: vals.length ? Math.max(...vals) : 1
  };
}

/* build an <svg> element for a graph in a given mode.
   opts: { interactive:bool } */
export function renderGraph(g, mode, opts){
  opts = opts || {};
  const pos = project(g.layout);
  const svg = el("svg",{ viewBox:"0 0 "+V+" "+V });
  const isWeighted = mode !== "original";
  /* complete = all pairs + MI;  weighted = original edges + MI */
  const edges = mode === "complete" ? g.completeEdges : g.originalEdges;

  const haveMI = isWeighted && g.mi && g.mi.length>0;
  let wmin=0, wmax=1;
  if(haveMI){
    /* always normalise over ALL pairs (complete graph), not just the drawn edges,
       so "Complete · MI" and "Original · MI" use the same scale for each graph */
    const st = nonzeroStats(g.mi);
    if(st.vals.length){ wmin=st.min; wmax=st.max; }
  }
  const wSpread = wmax-wmin;
  const wUniform = wSpread < 1e-9;

  const eg = el("g",{}); svg.appendChild(eg);

  for(const [a,b] of edges){
    if(!pos[a]||!pos[b]) continue;
    const [x1,y1]=pos[a], [x2,y2]=pos[b];
    const w = haveMI ? g.mi[pairIndex(a,b)] : null;
    let stroke, width;

    if(isWeighted){
      if(haveMI && w!=null && w<=ZERO) continue;   // zero MI → don't draw
      const t = (haveMI && w!=null && !wUniform) ? (w-wmin)/wSpread : 0.5;
      stroke = haveMI ? mix(COL.miLow,COL.miHigh,t) : COL.edgeComplete;
      width  = haveMI ? lerp(1.5,42,t) : 4;
    } else {
      stroke = COL.edgeOriginal; width = 8;
    }

    const line = el("line",{
      x1,y1,x2,y2, stroke,
      "stroke-width":width, "stroke-linecap":"round",
      "stroke-opacity": isWeighted ? 0.92 : 1,
      "stroke-dasharray": (isWeighted && !haveMI) ? "2 12" : "none"
    });
    eg.appendChild(line);

    if(haveMI){
      const label = "("+a+", "+b+")  MI = "+(w!=null?w.toFixed(4):"--");
      const title = document.createElementNS(NS,"title");
      title.textContent = label;
      line.appendChild(title);

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
  const ng = el("g",{});
  const r = g.n>7 ? 30 : 34;
  for(let i=0;i<g.n;i++){
    const [x,y]=pos[i];
    const c = el("circle",{ cx:x, cy:y, r, fill:COL.node });
    if(opts.interactive){
      const t=document.createElementNS(NS,"title");
      t.textContent = "node "+i+"  ·  degree "+g.deg[i];
      c.appendChild(t);
    }
    ng.appendChild(c);
    const lab = el("text",{
      x, y, "text-anchor":"middle", "dominant-baseline":"central",
      "font-family":"'Spline Sans Mono',monospace",
      "font-size":(g.n>7?32:36), "font-weight":600, fill:COL.nodeLabel
    });
    lab.textContent = i;
    ng.appendChild(lab);
  }
  svg.appendChild(ng);
  return svg;
}
