/* Entry point: boot, permalinks, theme and event wiring */
import { state, onStateChange } from "./state.js";
import { DATA_DIR, loadManifest, nValues, graphCount, layerNames, onShardLoaded } from "./data.js";
import { formatHash, readHash } from "./url.js";
import { resetPalette } from "./render.js";
import * as gallery from "./ui/gallery.js";
import * as modal from "./ui/modal.js";

const $ = id => document.getElementById(id);

/* layer data arrived after cards/modal were drawn */
onShardLoaded((N, layer)=>{
  gallery.layerLoaded(N, layer);
  modal.layerLoaded(N, layer);
});

/* ---------- permalinks ---------- */
let ready = false;
onStateChange(()=>{
  if(!ready) return;
  const h = formatHash(state);
  if(location.hash.slice(1) !== h) history.replaceState(null, "", "#"+h);
});

function applyHash(){
  const r = readHash(location.hash, { nValues: nValues(), count: graphCount, layers: layerNames });
  modal.closeModal();
  gallery.restore(r);
  if(r.modalId !== null) modal.openModal(r.modalId, r.view);
}
window.addEventListener("hashchange", applyHash);   // pasted link / edited hash

/* ---------- theme: auto (system) → light → dark ---------- */
const THEMES = ["auto", "light", "dark"];
const store = {
  get(){ try{ return localStorage.getItem("zoo-theme"); }catch{ return null; } },
  set(v){ try{ localStorage.setItem("zoo-theme", v); }catch{} }
};
let theme = THEMES.includes(store.get()) ? store.get() : "auto";

function redraw(){
  resetPalette();
  gallery.rerenderCurrentPage();
  modal.renderModal();
}
function applyTheme(){
  if(theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  $("themeBtn").textContent = "theme: "+theme;
  redraw();
}
$("themeBtn").addEventListener("click", ()=>{
  theme = THEMES[(THEMES.indexOf(theme)+1) % THEMES.length];
  store.set(theme);
  applyTheme();
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", ()=>{ if(theme === "auto") redraw(); });
applyTheme();

/* ---------- controls ---------- */
$("pagePrev").addEventListener("click",()=>gallery.gotoPage(state.page-1));
$("pageNext").addEventListener("click",()=>gallery.gotoPage(state.page+1));
$("pageSizeSelect").addEventListener("change", e=>gallery.setPageSize(parseInt(e.target.value,10)));
const jump = ()=>gallery.jumpToId(parseInt($("jumpInput").value,10));
$("jumpBtn").addEventListener("click", jump);
$("jumpInput").addEventListener("keydown", e=>{ if(e.key==="Enter") jump(); });
$("modalClose").addEventListener("click",modal.closeModal);
$("modalBack").addEventListener("click",e=>{
  if(e.target.id==="modalBack") modal.closeModal();
});
document.addEventListener("keydown",e=>{
  if(!modal.isOpen()) return;
  if(e.key==="Escape") modal.closeModal();
  else if(e.key==="Tab") modal.trapFocus(e);
  else if((e.key==="ArrowLeft" || e.key==="ArrowRight") && !e.altKey && !e.metaKey && !e.ctrlKey){
    e.preventDefault();
    modal.step(e.key==="ArrowLeft" ? -1 : 1);
  }
});

/* ---------- boot ---------- */
(async function init(){
  try{
    await loadManifest();
    if(!nValues().length) throw new Error("empty");
  }catch(err){
    $("galleryTitle").textContent="Could not load the catalogue";
    $("grid").innerHTML =
      '<div class="notice">Could not read <strong>'+DATA_DIR+'/manifest.json</strong>.<br><br>'+
      'Check that the <strong>data/</strong> folder is present next to index.html '+
      '(generate it with <strong>uv run tools/pack.py</strong>).</div>';
    return;
  }
  applyHash();
  ready = true;
  history.replaceState(null, "", "#"+formatHash(state));
})();
