/* Detail modal for a single graph */
import { loadGraph, getNMI } from "../data.js";
import { renderGraph, nonzeroStats } from "../render.js";
import { hideTip } from "./tooltip.js";

const $ = id => document.getElementById(id);

let modalGraph = null, modalMode = "original", openToken = 0;

export function currentModalGraph(){ return modalGraph; }

export function openModal(rec, mode){
  const token = ++openToken;
  modalGraph = null;
  $("modalStage").innerHTML='<div class="spinner"></div>';
  $("modalInfo").innerHTML="";
  $("legend").classList.remove("show");
  $("modalBack").classList.add("open");
  document.body.style.overflow="hidden";
  modalMode = mode;
  const fetches = [loadGraph(rec)];
  if(modalMode !== "original") fetches.push(getNMI(rec.N));
  Promise.all(fetches).then(([g])=>{
    if(token !== openToken) return;   // a newer open (or close) superseded this one
    modalGraph = g;
    syncSeg();
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

export function setModalMode(mode){
  modalMode = mode;
  syncSeg();
  if(mode !== "original" && modalGraph) getNMI(modalGraph.N);
  renderModal();
}

function syncSeg(){
  document.querySelectorAll("#modalSeg button").forEach(b=>
    b.setAttribute("aria-pressed", b.dataset.mode===modalMode ? "true":"false"));
}

export function renderModal(){
  const g = modalGraph;
  if(!g) return;
  const stage = $("modalStage");
  stage.innerHTML="";
  stage.appendChild(renderGraph(g, modalMode, {interactive:true}));

  const isW = modalMode !== "original";
  const legend = $("legend");
  legend.classList.toggle("show", isW && g.has.mi);
  if(isW && g.has.mi){
    const st = nonzeroStats(g.mi);
    $("legMin").textContent = st.vals.length ? st.min.toFixed(4) : "0";
    $("legMax").textContent = st.vals.length ? st.max.toFixed(4) : "—";
  }

  let miBlock="";
  if(isW && g.has.mi){
    const vals = g.mi;
    const mean = vals.reduce((s,v)=>s+v,0)/vals.length;
    const sd = Math.sqrt(vals.reduce((s,v)=>s+(v-mean)**2,0)/vals.length);
    miBlock =
      '<div><dt>MI mean</dt><dd>'+mean.toFixed(4)+'</dd></div>'+
      '<div><dt>MI std</dt><dd>'+sd.toFixed(4)+'</dd></div>';
  }
  $("modalInfo").innerHTML =
    '<div><div class="sub">Graph atlas entry</div>'+
      '<h3>N'+g.N+' &middot; id '+g.id+'</h3></div>'+
    (miBlock ? '<dl class="specs">'+miBlock+'</dl>' : '')+
    (isW && !g.has.mi
      ? '<div class="mi-missing">mi_N'+g.N+'.json not found or data missing for this graph &mdash; '+
        'weighted links shown dashed/uniform.</div>'
      : '')+
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
