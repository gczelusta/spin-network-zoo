/* Entry point: boot and event wiring */
import { state } from "./state.js";
import { DATA_DIR, loadManifest, nValues, onShardLoaded } from "./data.js";
import * as gallery from "./ui/gallery.js";
import * as modal from "./ui/modal.js";

const $ = id => document.getElementById(id);

/* layer data arrived after cards/modal were drawn */
onShardLoaded((N, layer)=>{
  gallery.layerLoaded(N, layer);
  modal.layerLoaded(N, layer);
});

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
document.addEventListener("keydown",e=>{ if(e.key==="Escape") modal.closeModal(); });

(async function init(){
  try{
    await loadManifest();
    const Ns = nValues();
    if(!Ns.length) throw new Error("empty");
    gallery.buildControls();
    gallery.selectN(Ns[0]);
  }catch(err){
    $("galleryTitle").textContent="Could not load the catalogue";
    $("grid").innerHTML =
      '<div class="notice">Could not read <strong>'+DATA_DIR+'/manifest.json</strong>.<br><br>'+
      'Check that the <strong>data/</strong> folder is present next to index.html '+
      '(generate it with <strong>uv run tools/pack.py</strong>).</div>';
  }
})();
