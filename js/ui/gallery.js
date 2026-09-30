/* Gallery: N pills, view controls, paginated card grid */
import { state, sameView } from "../state.js";
import { nValues, graphCount, loadGraph, layerValues, layerMeta } from "../data.js";
import { renderGraph } from "../render.js";
import { buildViewControls, describeView } from "./controls.js";
import { openModal } from "./modal.js";

const $ = id => document.getElementById(id);

function buildNPills(){
  const wrap = $("nPills");
  wrap.innerHTML="";
  nValues().forEach(N=>{
    const b = document.createElement("button");
    b.className="pill mono";
    b.innerHTML = "N = "+N+'<span class="n-count">'+graphCount(N).toLocaleString()+"</span>";
    b.setAttribute("aria-pressed", N===state.N ? "true":"false");
    b.addEventListener("click",()=>selectN(N));
    wrap.appendChild(b);
  });
}

export function buildControls(){
  buildViewControls($("viewControls"), state.view, setView);
}

export function selectN(N){
  state.N = N;
  state.page = 0;
  buildNPills();
  updateGallery();
}

function pageCount(){
  return Math.max(1, Math.ceil(graphCount(state.N) / state.pageSize));
}

export function updateGallery(){
  const total = graphCount(state.N);
  const pages = pageCount();

  $("galleryTitle").textContent =
    total.toLocaleString()+" graph"+(total!==1?"s":"")+" on "+state.N+" nodes";
  $("galleryCount").textContent = "viewing "+describeView(state.view);

  const bar = $("pageBar");
  if(total > state.pageSize){
    bar.style.display = "flex";
    $("pagePrev").disabled = state.page === 0;
    $("pageNext").disabled = state.page >= pages-1;
    $("pageIndicator").textContent =
      (state.page+1).toLocaleString()+" / "+pages.toLocaleString();
    $("jumpInput").max = total-1;
  } else {
    bar.style.display = "none";
  }

  renderPage();
}

function renderPage(){
  const N = state.N;
  const start = state.page * state.pageSize;
  const end = Math.min(graphCount(N), start + state.pageSize);
  const grid = $("grid");
  grid.innerHTML = "";
  for(let id=start; id<end; id++){
    const card = document.createElement("button");
    card.className = "card";
    card.dataset.n = N;
    card.dataset.id = id;
    card.style.animationDelay = ((id-start)*30)+"ms";
    card.innerHTML =
      '<div class="card-figure"><div class="spinner"></div></div>'+
      '<div class="card-meta"><span class="card-id">'+id+'</span></div>';
    card.addEventListener("click", ()=>openModal(N, id, state.view));
    grid.appendChild(card);
    loadGraph(N, id).then(g=>fillCard(card,g))
      .catch(()=>{
        card.querySelector(".card-figure").innerHTML =
          '<span class="mono" style="font-size:10px;color:var(--ink-soft)">no data</span>';
      });
  }
}

/* "no MI"-style badge text for layers the view needs but this graph lacks */
function missingLayers(g, view){
  return [view.edge, view.node].filter(l => {
    if(!l) return false;
    const s = layerValues(g, l).status;
    return s === "missing" || s === "absent";
  }).map(l => layerMeta(l).short || l);
}

function fillCard(card, g){
  if(!card.isConnected) return;   // page changed while loading
  card.graph = g;
  const fig = card.querySelector(".card-figure");
  fig.innerHTML="";
  fig.appendChild(renderGraph(g, state.view, {}));

  card.querySelector(".badge")?.remove();
  const miss = missingLayers(g, state.view);
  if(miss.length){
    const bd = document.createElement("span");
    bd.className="badge"; bd.textContent="no "+miss.join(", ");
    card.appendChild(bd);
  }
}

export function rerenderCurrentPage(){
  document.querySelectorAll("#grid .card").forEach(card=>{
    if(card.graph) fillCard(card, card.graph);
  });
}

/* a layer shard for N arrived — redraw if the gallery is showing it */
export function layerLoaded(N, layer){
  if(state.N === N && (state.view.edge === layer || state.view.node === layer)) rerenderCurrentPage();
}

export function setView(view){
  if(sameView(view, state.view)) return;
  state.view = view;
  buildControls();
  $("galleryCount").textContent = "viewing "+describeView(view);
  rerenderCurrentPage();
}

function scrollToGrid(){ $("grid").scrollIntoView({behavior:"smooth", block:"start"}); }

export function gotoPage(p){
  if(p < 0 || p >= pageCount() || p === state.page) return;
  state.page = p;
  updateGallery();
  scrollToGrid();
}

export function setPageSize(size){
  state.pageSize = size;
  state.page = 0;
  updateGallery();
}

export function jumpToId(id){
  if(isNaN(id) || id < 0 || id >= graphCount(state.N)) return;
  state.page = Math.floor(id / state.pageSize);
  updateGallery();
  scrollToGrid();
}
