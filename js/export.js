/* Downloads for a single graph: SVG, PNG (2×) and JSON */
import { renderGraph, V } from "./render.js";
import { layerNames, layerMeta, layerValues } from "./data.js";

const NS = "http://www.w3.org/2000/svg";

function download(blob, name){
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

/* e.g. "zoo-N13-id345-complete-mi-scale_n" */
export function baseName(g, view){
  const parts = ["zoo", "N"+g.N, "id"+g.id];
  if(view){
    if(view.edges === "complete") parts.push("complete");
    if(view.edge) parts.push(view.edge);
    if(view.node) parts.push(view.node);
    if((view.edge || view.node) && view.scale !== "graph") parts.push("scale_"+view.scale);
  }
  return parts.join("-");
}

/* standalone SVG document: literal colours, page background, fixed size */
export function svgString(g, view){
  const svg = renderGraph(g, view, {});
  svg.setAttribute("width", V);
  svg.setAttribute("height", V);
  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", getComputedStyle(document.documentElement).getPropertyValue("--paper").trim());
  svg.insertBefore(bg, svg.firstChild);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}

export function exportSVG(g, view){
  download(new Blob([svgString(g, view)], { type:"image/svg+xml" }), baseName(g, view)+".svg");
}

/* rasterised via <img>; web fonts don't load inside SVG images, so node
   labels fall back to the system monospace font                         */
export async function exportPNG(g, view, scale = 2){
  const url = URL.createObjectURL(new Blob([svgString(g, view)], { type:"image/svg+xml" }));
  try{
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = c.height = V*scale;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(res => c.toBlob(res, "image/png"));
    download(blob, baseName(g, view)+".png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/* the graph and every layer value loaded for it */
export function graphJSON(g){
  const layers = {};
  for(const l of layerNames()){
    const L = layerValues(g, l);
    if(L.status !== "ok") continue;
    const m = layerMeta(l);
    layers[l] = {
      kind: m.kind, label: m.label,
      ...(m.kind === "pair" ? { order: "graph6 upper triangle: (0,1),(0,2),(1,2),(0,3),…" } : {}),
      values: m.kind === "graph" ? L.values[0] : Array.from(L.values)
    };
  }
  return {
    N: g.N, id: g.id, graph6: g.graph6, n: g.n,
    edges: g.originalEdges,
    layout: g.hasLayout ? g.layout.map(([x,y]) => [+x.toFixed(5), +y.toFixed(5)]) : null,
    layers
  };
}

export function exportJSON(g){
  download(new Blob([JSON.stringify(graphJSON(g), null, 1)], { type:"application/json" }), baseName(g)+".json");
}
