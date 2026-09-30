/* Detail modal for a single graph of the current N. Its view is independent
   of the gallery and lives in state.modal so it ends up in the permalink.   */
import { state, sameView, stateChanged } from "../state.js";
import { loadGraph, graphCount, layerNames, layerMeta, layerValues, layerReady, hasLayer } from "../data.js";
import { renderGraph, layerScale, layerStats, mix, palette } from "../render.js";
import { exportSVG, exportPNG, exportJSON } from "../export.js";
import { buildViewControls } from "./controls.js";
import { revealId } from "./gallery.js";
import { hideTip } from "./tooltip.js";

const $ = id => document.getElementById(id);

let modalGraph = null, openToken = 0, returnFocus = null;
let pendingFocus = "";   // id of the focused modal element, restored after re-render

function focusedId(){
  const a = document.activeElement;
  return a && a.id && $("modal").contains(a) ? a.id : "";
}

export function isOpen(){ return state.modal !== null; }

export function openModal(id, view){
  const N = state.N;
  if(!isOpen()) returnFocus = document.activeElement;
  const token = ++openToken;
  pendingFocus = focusedId() || pendingFocus;
  modalGraph = null;
  state.modal = { id, view: { ...view } };
  $("modalStage").innerHTML='<div class="spinner"></div>';
  $("modalInfo").innerHTML="";
  $("legends").innerHTML="";
  buildViewControls($("modalControls"), state.modal.view, setModalView);
  $("modalBack").classList.add("open");
  document.body.style.overflow="hidden";
  if(!$("modal").contains(document.activeElement)) $("modalClose").focus({ preventScroll:true });
  stateChanged();
  /* the info panel lists every layer, so fetch all of them for this graph */
  Promise.all([loadGraph(N, id), ...layerNames().map(l=>layerReady(N, id, l))]).then(([g])=>{
    if(token !== openToken) return;   // a newer open (or close) superseded this one
    modalGraph = g;
    renderModal();
  });
}

export function closeModal(){
  if(!isOpen()) return;
  const id = state.modal.id;
  openToken++;
  modalGraph = null;
  pendingFocus = "";
  state.modal = null;
  $("modalBack").classList.remove("open");
  document.body.style.overflow="";
  hideTip();
  /* back to the card of the graph last shown (the page may have moved) */
  const card = revealId(id);
  (card || returnFocus)?.focus?.({ preventScroll:true });
  returnFocus = null;
  stateChanged();
}

/* previous / next graph of this N */
export function step(delta){
  if(!isOpen()) return;
  const id = state.modal.id + delta;
  if(id < 0 || id >= graphCount(state.N)) return;
  openModal(id, state.modal.view);
}

function setModalView(view){
  if(sameView(view, state.modal.view)) return;
  state.modal.view = view;
  buildViewControls($("modalControls"), view, setModalView);
  renderModal();
  stateChanged();
}

/* a layer shard arrived (e.g. after eviction) — redraw if it concerns the open graph */
export function layerLoaded(N){
  if(modalGraph && modalGraph.N === N) renderModal();
}

/* keep Tab focus inside the dialog */
export function trapFocus(e){
  const f = [...$("modal").querySelectorAll("button,input,select,[tabindex]:not([tabindex='-1'])")]
    .filter(x => !x.disabled && x.offsetParent !== null);
  if(!f.length) return;
  const first = f[0], last = f[f.length-1];
  if(e.shiftKey && document.activeElement === first){ last.focus(); e.preventDefault(); }
  else if(!e.shiftKey && document.activeElement === last){ first.focus(); e.preventDefault(); }
  else if(!$("modal").contains(document.activeElement)){ first.focus(); e.preventDefault(); }
}

function legend(g, name, low, high, scale){
  const L = layerValues(g, name);
  if(L.status !== "ok") return "";
  const m = layerMeta(name), sc = layerScale(g, name, L.values, scale);
  return '<div class="legend">'+
    '<span class="legend-title">'+m.label+({n:" · scale over N = "+g.N, all:" · scale over all N"}[scale] ?? "")+'</span>'+
    '<div class="legend-bar" style="background:linear-gradient(90deg,'+mix(low,high,0)+','+mix(low,high,1)+')"></div>'+
    '<div class="legend-scale"><span>'+sc.min.toFixed(4)+'</span><span>'+sc.max.toFixed(4)+'</span></div>'+
  '</div>';
}

function spec(label, value){ return '<div><dt>'+label+'</dt><dd>'+value+'</dd></div>'; }

function flash(btn, text){
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(()=>{ btn.textContent = old; }, 1500);
}

export function renderModal(){
  const g = modalGraph;
  if(!g || !isOpen()) return;
  const view = state.modal.view, P = palette();
  const keep = pendingFocus || focusedId();
  pendingFocus = "";
  const stage = $("modalStage");
  stage.innerHTML="";
  stage.appendChild(renderGraph(g, view, {interactive:true}));

  $("legends").innerHTML =
    (view.edge ? legend(g, view.edge, P.edgeLow, P.edgeHigh, view.scale) : "")+
    (view.node ? legend(g, view.node, P.nodeLow, P.nodeHigh, view.scale) : "");

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

  const missing = [view.edge, view.node].filter(l => l && layerValues(g, l).status !== "ok");
  const notice = missing.map(l =>
    '<div class="mi-missing">'+layerMeta(l).label+' '+
    (hasLayer(g.N, l) ? "is missing for this graph" : "is not available for N = "+g.N)+
    ' &mdash; shown '+(l===view.edge ? "dashed/uniform" : "uncoloured")+'.</div>').join("");

  const count = graphCount(g.N);
  $("modalInfo").innerHTML =
    '<div><div class="sub">Graph atlas entry</div>'+
      '<h3 id="modalTitle">N'+g.N+' &middot; id '+g.id+'</h3></div>'+
    (specs ? '<dl class="specs">'+specs+'</dl>' : '')+
    notice+
    '<div><div class="legend-title" style="margin-bottom:5px;">graph6 code</div>'+
      '<div class="g6" id="g6copy" title="Click to copy" role="button" tabindex="0">'+
        '<span id="g6text">'+g.graph6+'</span>'+
        '<span class="g6-copy" id="g6hint">copy</span>'+
      '</div></div>'+
    '<div><div class="legend-title" style="margin-bottom:5px;">share &amp; export</div>'+
      '<div class="modal-tools">'+
        '<button class="page-btn" id="copyLink">Copy link</button>'+
        '<button class="page-btn" id="dlSVG">SVG</button>'+
        '<button class="page-btn" id="dlPNG">PNG</button>'+
        '<button class="page-btn" id="dlJSON">JSON</button>'+
      '</div></div>'+
    '<div class="modal-nav">'+
      '<button class="page-btn" id="modalPrev"'+(g.id>0?'':' disabled')+'>&larr; Prev</button>'+
      '<button class="page-btn" id="modalNext"'+(g.id<count-1?'':' disabled')+'>Next &rarr;</button>'+
      '<span class="hint">&larr; &rarr; keys</span>'+
    '</div>';

  const copyG6 = ()=>navigator.clipboard.writeText(g.graph6).then(()=>{
    const box=$("g6copy"), hint=$("g6hint");
    box.classList.add("copied"); hint.textContent="copied!";
    setTimeout(()=>{ box.classList.remove("copied"); hint.textContent="copy"; },1500);
  });
  $("g6copy").addEventListener("click", copyG6);
  $("g6copy").addEventListener("keydown", e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); copyG6(); } });
  $("copyLink").addEventListener("click", e=>
    navigator.clipboard.writeText(location.href).then(()=>flash(e.target, "Copied!")));
  $("dlSVG").addEventListener("click", ()=>exportSVG(g, view));
  $("dlPNG").addEventListener("click", ()=>exportPNG(g, view));
  $("dlJSON").addEventListener("click", ()=>exportJSON(g));
  $("modalPrev").addEventListener("click", ()=>step(-1));
  $("modalNext").addEventListener("click", ()=>step(+1));

  if(keep){
    const el = $(keep);
    (el && !el.disabled ? el : $("modalClose")).focus({ preventScroll:true });
  }
}
