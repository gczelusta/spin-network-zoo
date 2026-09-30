/* shared UI state */
export const state = {
  N: null,
  page: 0,
  pageSize: 24,
  /* what to draw:
     edges  original | complete
     edge   pair-layer name weighting the edges, or null
     node   node-layer name colouring the nodes, or null
     scale  graph (normalise per graph) | n (range over all graphs with this N)
            | all (range over every N) — ranges come from the manifest          */
  view: { edges:"original", edge:null, node:null, scale:"graph" }
};

export function sameView(a, b){
  return a.edges===b.edges && a.edge===b.edge && a.node===b.node && a.scale===b.scale;
}
