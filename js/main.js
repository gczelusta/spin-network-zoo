/* Entry point: boot and event wiring */
import { state } from "./state.js";
import { DATA_DIR, loadCatalogue, onMILoaded } from "./data.js";
import { selectN, setMode, gotoPage, setPageSize, jumpToId, rerenderCurrentPage } from "./ui/gallery.js";
import { closeModal, setModalMode, renderModal, currentModalGraph } from "./ui/modal.js";

const $ = id => document.getElementById(id);

/* MI for some N arrived after cards/modal were drawn */
onMILoaded(N=>{
  if(state.N === N && state.mode !== "original") rerenderCurrentPage();
  const mg = currentModalGraph();
  if(mg && mg.N === N) renderModal();
});

document.querySelectorAll("#modeSeg button").forEach(b=>
  b.addEventListener("click",()=>setMode(b.dataset.mode)));
$("pagePrev").addEventListener("click",()=>gotoPage(state.page-1));
$("pageNext").addEventListener("click",()=>gotoPage(state.page+1));
$("pageSizeSelect").addEventListener("change", e=>setPageSize(parseInt(e.target.value,10)));
const jump = ()=>jumpToId(parseInt($("jumpInput").value,10));
$("jumpBtn").addEventListener("click", jump);
$("jumpInput").addEventListener("keydown", e=>{ if(e.key==="Enter") jump(); });
document.querySelectorAll("#modalSeg button").forEach(b=>
  b.addEventListener("click",()=>setModalMode(b.dataset.mode)));
$("modalClose").addEventListener("click",closeModal);
$("modalBack").addEventListener("click",e=>{
  if(e.target.id==="modalBack") closeModal();
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape") closeModal(); });

(async function init(){
  try{
    state.byN = await loadCatalogue();
    if(state.byN.size===0) throw new Error("empty");
    selectN([...state.byN.keys()].sort((a,b)=>a-b)[0]);
  }catch(err){
    $("galleryTitle").textContent="Could not load the catalogue";
    $("grid").innerHTML =
      '<div class="notice">Could not read <strong>'+DATA_DIR+'/zoo.csv</strong>.<br><br>'+
      (location.protocol==="file:"
        ? "Browsers block file access from <strong>file://</strong> pages.<br>"+
          "Run a local server &mdash; e.g. <strong>python3 -m http.server</strong> &mdash;<br>"+
          "or publish the folder with GitHub&nbsp;Pages."
        : "Check that the <strong>data/</strong> folder is present next to index.html.")+
      '</div>';
  }
})();
