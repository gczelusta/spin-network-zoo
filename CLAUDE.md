# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Spin Network Zoo is a static browser for precomputed observables of spin networks on every 4-regular simple graph with up to 15 nodes. The first observable is mutual information (MI) between node pairs. More are planned, and the viewer handles them generically as *layers*.

It's hosted on GitHub Pages. There's no build step: `index.html` loads plain ES modules from `js/` and styles from `css/zoo.css`. The data is generated in a separate repo. This repo only packs that data into the web format.

## Commands

```
python3 -m http.server          # serve locally (ES modules don't load from file://)
npm test                        # node --test tests/  — unit tests for the pure modules (no deps)
node --test tests/graph6.test.mjs   # a single test file
uv run tools/pack.py            # pack raw/ into data/  (numpy is declared inline, PEP 723)
uv run tools/pack.py --check    # verify data/ against raw/ on sampled ids
```

`package.json` exists only so node treats `js/` as ES modules and to define `npm test`. It has no dependencies. Use uv for Python, not conda or pip.

## Data flow

`raw/` (gitignored) holds the pipeline output: `zoo.csv` (`N,id,graph6`), `layout_N{N}.json` and `{layer}_N{N}.json`. `tools/pack.py` converts these into the committed `data/`:

- `data/manifest.json`: per-N `count`, `layers` (which of `layout`, `mi`, … exist for that N) and `layoutScale`, plus layer metadata (`kind`, `label`, `short`, `zeroThreshold`, and a per-N `range`).
- `data/N{N}/graphs-{k}.txt`, `layout-{k}.bin` (int16) and `{layer}-{k}.bin` (float32), in shards of `shardSize` (4096) graphs each. A graph's `id` is its index within N, and shard `k` holds ids `k*S … k*S+S-1`.
- **Pair order contract:** a pair layer stores n(n-1)/2 values in graph6 upper-triangle order (`for j in 1..n-1: for i in 0..j-1`). Use `pairIndex(i,j)` in `js/graph6.js` to index it.
- A missing graph is stored as NaN in layer shards and as -32768 in layout shards. The viewer then falls back to a circular layout, dashed edges or uncoloured nodes, and shows a "no X" badge.
- **Adding an observable:** the pipeline writes `{name}_N{N}.json`, and you add a definition either to `LAYERS` in `tools/pack.py` or to `raw/layers.json`, then re-pack. `kind` is `pair` (edge weight), `node` (node colour) or `graph` (a scalar shown in the modal). The viewer builds its controls from the manifest, so it needs no code change.
- **Size budget:** keep every file under 100 MB and the whole site under ~1 GB. Before committing, check with `du -sh data`.

## Viewer architecture (`js/`)

- `data.js` is the only module that touches the network. Shards are fetched on demand and cached as shared Promises in an LRU. It exposes three main calls:
  - `loadGraph(N,id)` returns the static graph: edges, layout and degrees.
  - `layerValues(g, name)` is synchronous and returns `{status: ok|pending|missing|absent, values}`. If the shard isn't loaded yet, it starts the fetch.
  - When a layer shard arrives, `onShardLoaded` fires and `main.js` tells the gallery and modal to redraw.
- `state.view = {edges, edge, node, scale}` fully describes a drawing. `render.js#renderGraph(g, view)` is the single renderer, used both for cards and for the modal.
  - Per-graph scaling normalises over all significant values, including pairs that aren't drawn as edges, so the original-edge and complete views of a graph share one scale. `scale: "n"` uses the manifest's range for that N instead. `scale: "all"` uses the range over every N, so it shifts whenever a larger N adds more extreme values.
- `ui/controls.js` builds the view controls from the manifest, for both the gallery bar and the modal. The modal keeps its own view in `state.modal = {id, view}`, independent of the gallery.
- **Permalinks:** after mutating `state`, modules call `stateChanged()`, and `main.js` rewrites the URL hash with `history.replaceState`. `js/url.js` holds the pure `formatHash`/`readHash` functions, which are unit-tested. When a graph is open, the hash carries the modal's view and `g=<id>`. On load or `hashchange`, `readHash` validates the hash against the manifest and `gallery.restore` applies it.
- **Theme:** colours are CSS tokens in `css/zoo.css`, with a dark set under `prefers-color-scheme` and `[data-theme]`. The graph colours are the `--g-*` tokens. `render.js#palette()` reads them as literal RGB, so exported SVGs are standalone, and caches them. Call `resetPalette()` and redraw when the theme changes.
- `export.js` builds the SVG, PNG and JSON downloads from `renderGraph`.

## Roadmap

The plan is at `~/.claude/plans/this-project-aims-to-whimsical-blanket.md`. Phases 0–3 are done: the module split, the sharded format with the packer, generic layers, and permalinks/export/dark mode/keyboard navigation. The ideas listed as "Later" are next: filtering and sorting by graph-level layers, ensemble plots, and side-by-side comparison.
