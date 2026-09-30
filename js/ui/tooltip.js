const tip = document.getElementById("tooltip");

export function showTip(ev, text){
  tip.textContent=text; tip.style.display="block";
  tip.style.left=ev.clientX+"px"; tip.style.top=ev.clientY+"px";
}
export function hideTip(){ tip.style.display="none"; }
