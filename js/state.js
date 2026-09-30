/* shared UI state */
export const state = {
  byN: new Map(),     // N → records sorted by id
  N: null,
  mode: "original",   // original | complete | weighted
  page: 0,
  pageSize: 24
};

export const MLABEL = {
  original:"original structure",
  complete:"complete graph · MI",
  weighted:"original edges · MI"
};
