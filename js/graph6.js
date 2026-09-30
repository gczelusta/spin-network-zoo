/* graph6 decoding and pure graph helpers — no DOM, testable under node */

export function decodeGraph6(s){
  const b = [];
  for(let i=0;i<s.length;i++) b.push(s.charCodeAt(i));
  let n, idx;
  if(b[0]===126){
    if(b[1]===126){ n=0; for(let k=2;k<8;k++) n=n*64+(b[k]-63); idx=8; }
    else { n=0; for(let k=1;k<4;k++) n=n*64+(b[k]-63); idx=4; }
  } else { n=b[0]-63; idx=1; }
  const bits = [];
  for(let k=idx;k<b.length;k++){
    const v = b[k]-63;
    for(let j=5;j>=0;j--) bits.push((v>>j)&1);
  }
  const edges = [];
  let p = 0;
  for(let j=1;j<n;j++)
    for(let i=0;i<j;i++){ if(bits[p]===1) edges.push([i,j]); p++; }
  return { n, edges };
}

/* index of pair (i,j) in canonical graph6 upper-triangle order:
   for j in 1..n-1: for i in 0..j-1  →  (0,1),(0,2),(1,2),(0,3),…
   This is the order of every per-pair data array.                   */
export function pairIndex(i, j){
  if(i > j){ const t=i; i=j; j=t; }
  return j*(j-1)/2 + i;
}

export function pairCount(n){ return n*(n-1)/2; }

export function circularLayout(n){
  const pts = [];
  for(let i=0;i<n;i++){
    const a = -Math.PI/2 + 2*Math.PI*i/n;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  return pts;
}

export function completeEdges(n){
  const e = [];
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) e.push([i,j]);
  return e;
}
