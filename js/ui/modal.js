/* Detail modal for a single graph, with its own view independent of the gallery */
import { sameView } from "../state.js";
import { loadGraph, layerNames, layerMeta, layerValues, layerReady, hasLayer } from "../data.js";
import { renderGraph, layerScale, layerStats, mix, COL } from "../render.js";
import { buildViewControls } from "./controls.js";
import { hideTip } from "./tooltip.js";

const $ = id => document.getElementById(id);

let modalGraph = null, modalView = null, openToken = 0;

export function openModal(N, id, view){
  const token = ++openToken;
  modalGraph = null;
  modalView = { ...view };
  $("modalStage").innerHTML='<div class="spinner"></div>';
  $("modalInfo").innerHTML="";
  $("legends").innerHTML="";
  buildViewControls($("modalControls"), modalView, setModalView);
  $("modalBack").classList.add("open");
  document.body.style.overflow="hidden";
  /* the info panel lists every layer, so fetch all of them for this graph */
  Promise.all([loadGraph(N, id), ...layerNames().map(l=>layerReady(N, id, l))]).then(([g])=>{
    if(token !== openToken) return;   // a newer open (or close) superseded this one
    modalGraph = g;
    renderModal();
  });
}

export function closeModal(){
  openToken++;
  modalGraph = null;
  $("modalBack").classList.remove("open");
  document.body.style.overflow="";
  hideTip();
}

function setModalView(view){
  if(sameView(view, modalView)) return;
  modalView = view;
  buildViewControls($("modalControls"), modalView, setModalView);
  renderModal();
}

/* a layer shard arrived (e.g. after eviction) — redraw if it concerns the open graph */
export function layerLoaded(N){
  if(modalGraph && modalGraph.N === N) renderModal();
}

function legend(g, name, low, high){
  const L = layerValues(g, name);
  if(L.status !== "ok") return "";
  const m = layerMeta(name), sc = layerScale(g, name, L.values, modalView.scale);
  return '<div class="legend">'+
    '<span class="legend-title">'+m.label+({n:" · scale over N = "+g.N, all:" · scale over all N"}[modalView.scale] ?? "")+'</span>'+
    '<div class="legend-bar" style="background:linear-gradient(90deg,'+mix(low,high,0)+','+mix(low,high,1)+')"></div>'+
    '<div class="legend-scale"><span>'+sc.min.toFixed(4)+'</span><span>'+sc.max.toFixed(4)+'</span></div>'+
  '</div>';
}

function spec(label, value){ return '<div><dt>'+label+'</dt><dd>'+value+'</dd></div>'; }

export function renderModal(){
  const g = modalGraph;
  if(!g) return;
  const stage = $("modalStage");
  stage.innerHTML="";
  stage.appendChild(renderGraph(g, modalView, {interactive:true}));

  $("legends").innerHTML =
    (modalView.edge ? legend(g, modalView.edge, COL.edgeLow, COL.edgeHigh) : "")+
    (modalView.node ? legend(g, modalView.node, COL.nodeLow, COL.nodeHigh) : "");

  /* stats for every layer this graph has */
  let specs = "";
  for(const l of layerNames()){
    const L = layerValues(g, l);
    if(L.status !== "ok") continue;
    const m = layerMeta(l), short = m.short || l;
    if(m.kind === "graph"){ specs += spec(m.label, L.values[0].toFixed(4)); continue; }
    const st = layerStats(L.values, l);
    specs += spec(short+" mean", st.mean.toFixed(4)) + spec(short+" std", st.std.toFixed(4));
  }

  const missing = [modalView.edge, modalView.node].filter(l => l && layerValues(g, l).status !== "ok");
  const notice = missing.map(l =>
    '<div class="mi-missing">'+layerMeta(l).label+' '+
    (hasLayer(g.N, l) ? "is missing for this graph" : "is not available for N = "+g.N)+
    ' &mdash; shown '+(l===modalView.edge ? "dashed/uniform" : "uncoloured")+'.</div>').join("");

  $("modalInfo").innerHTML =
    '<div><div class="sub">Graph atlas entry</div>'+
      '<h3>N'+g.N+' &middot; id '+g.id+'</h3></div>'+
    (specs ? '<dl class="specs">'+specs+'</dl>' : '')+
    notice+
    '<div><div class="legend-title" style="margin-bottom:5px;">graph6 code</div>'+
      '<div class="g6" id="g6copy" title="Click to copy">'+
        '<span id="g6text">'+g.graph6+'</span>'+
        '<span class="g6-copy" id="g6hint">copy</span>'+
      '</div></div>';
  $("g6copy").addEventListener("click",()=>{
    navigator.clipboard.writeText(g.graph6).then(()=>{
      const box=$("g6copy"), hint=$("g6hint");
      box.classList.add("copied"); hint.textContent="copied!";
      setTimeout(()=>{ box.classList.remove("copied"); hint.textContent="copy"; },1500);
    });
  });
}
