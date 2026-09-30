/* Gallery: N pills, paginated card grid */
import { state, MLABEL } from "../state.js";
import { loadGraph, getNLayout, getNMI, miSettled, cachedGraph } from "../data.js";
import { renderGraph } from "../render.js";
import { openModal } from "./modal.js";

const $ = id => document.getElementById(id);

function buildNPills(){
  const wrap = $("nPills");
  wrap.innerHTML="";
  [...state.byN.keys()].sort((a,b)=>a-b).forEach(N=>{
    const b = document.createElement("button");
    b.className="pill mono";
    b.innerHTML = "N = "+N+'<span class="n-count">'+state.byN.get(N).length+"</span>";
    b.setAttribute("aria-pressed", N===state.N ? "true":"false");
    b.addEventListener("click",()=>selectN(N));
    wrap.appendChild(b);
  });
}

export function selectN(N){
  state.N = N;
  state.page = 0;
  buildNPills();
  updateGallery();
}

function pageCount(){
  const total = (state.byN.get(state.N)||[]).length;
  return Math.max(1, Math.ceil(total / state.pageSize));
}

export function updateGallery(){
  const recs = state.byN.get(state.N) || [];
  const total = recs.length;
  const pages = pageCount();

  $("galleryTitle").textContent =
    total.toLocaleString()+" graph"+(total!==1?"s":"")+" on "+state.N+" nodes";
  $("galleryCount").textContent = "viewing "+MLABEL[state.mode];

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

  renderPage(recs);
}

function renderPage(recs){
  /* kick off N-level fetches before building cards */
  getNLayout(state.N);
  if(state.mode !== "original") getNMI(state.N);

  const start = state.page * state.pageSize;
  const pageRecs = recs.slice(start, start + state.pageSize);
  const grid = $("grid");
  grid.innerHTML = "";
  pageRecs.forEach((rec, i)=>{
    const card = document.createElement("button");
    card.className = "card";
    card.dataset.n = rec.N;
    card.dataset.id = rec.id;
    card.style.animationDelay = (i*30)+"ms";
    card.innerHTML =
      '<div class="card-figure"><div class="spinner"></div></div>'+
      '<div class="card-meta"><span class="card-id">'+rec.id+'</span></div>';
    card.addEventListener("click", ()=>openModal(rec, state.mode));
    grid.appendChild(card);
    loadGraph(rec).then(g=>fillCard(card,g))
      .catch(()=>{
        card.querySelector(".card-figure").innerHTML =
          '<span class="mono" style="font-size:10px;color:var(--ink-soft)">no data</span>';
      });
  });
}

function fillCard(card, g){
  if(!card.isConnected) return;   // page changed while loading
  const fig = card.querySelector(".card-figure");
  fig.innerHTML="";
  fig.appendChild(renderGraph(g, state.mode, {}));

  const old = card.querySelector(".badge");
  if(old) old.remove();
  if(state.mode!=="original" && miSettled(g.N) && !g.has.mi){
    const bd = document.createElement("span");
    bd.className="badge"; bd.textContent="no MI";
    card.appendChild(bd);
  }
}

export function rerenderCurrentPage(){
  document.querySelectorAll("#grid .card").forEach(card=>{
    const g = cachedGraph(+card.dataset.n, +card.dataset.id);
    if(g) fillCard(card, g);
  });
}

export function setMode(mode){
  state.mode = mode;
  document.querySelectorAll("#modeSeg button").forEach(b=>
    b.setAttribute("aria-pressed", b.dataset.mode===mode ? "true":"false"));
  $("galleryCount").textContent = "viewing "+MLABEL[mode];
  if(mode !== "original") getNMI(state.N);   // lazy-fetch; MI listener re-renders
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
  if(isNaN(id) || id < 0) return;
  const recs = state.byN.get(state.N) || [];
  const idx = recs.findIndex(r => r.id === id);
  if(idx < 0) return;
  state.page = Math.floor(idx / state.pageSize);
  updateGallery();
  scrollToGrid();
}
