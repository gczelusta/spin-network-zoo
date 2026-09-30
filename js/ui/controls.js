/* View controls (edges / edge weight / node colour / scale), built from the
   manifest's layer list. Used by both the gallery bar and the modal.        */
import { layerNames, layerMeta } from "../data.js";

function seg(label, key, options, view){
  return '<div class="ctrl-group"><span class="ctrl-label">'+label+'</span>'+
    '<div class="seg" data-key="'+key+'">'+
    options.map(([value, text]) =>
      '<button data-value="'+(value ?? "")+'" aria-pressed="'+(view[key]===value)+'">'+text+'</button>'
    ).join("")+
    '</div></div>';
}

/* render controls into root; onChange(newView) fires on every click */
export function buildViewControls(root, view, onChange){
  const pair = layerNames("pair"), node = layerNames("node");
  const name = l => layerMeta(l).short || layerMeta(l).label;
  root.innerHTML =
    seg("Edges", "edges", [["original","Original"],["complete","Complete"]], view)+
    (pair.length ? seg("Edge weight", "edge", [[null,"None"], ...pair.map(l=>[l, name(l)])], view) : "")+
    (node.length ? seg("Node colour", "node", [[null,"None"], ...node.map(l=>[l, name(l)])], view) : "")+
    (pair.length || node.length ? seg("Scale", "scale", [["graph","Per graph"],["n","Per N"],["all","All N"]], view) : "");
  root.querySelectorAll(".seg").forEach(s=>{
    s.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
      const v = { ...view, [s.dataset.key]: b.dataset.value || null };
      onChange(v);
    }));
  });
}

/* short human description of a view, e.g. "complete graph · MI" */
export function describeView(view){
  const parts = [view.edges==="complete" ? "complete graph" : (view.edge ? "original edges" : "original structure")];
  for(const l of [view.edge, view.node]) if(l) parts.push(layerMeta(l).short || layerMeta(l).label);
  if(view.edge || view.node){
    if(view.scale==="n") parts.push("per-N scale");
    if(view.scale==="all") parts.push("all-N scale");
  }
  return parts.join(" · ");
}
