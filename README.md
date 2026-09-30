# Spin Network Zoo

An interactive browser for precomputed observables of spin networks on every
4-regular simple graph with 5 to 15 nodes (about 906,000 graphs).

The first observable is the **mutual information (MI)** between pairs of
nodes. The viewer handles observables generically as *layers*, so more can be
added without changing its code.

**Live site:** <https://gczelusta.github.io/spin-network-zoo/>

## Features

- Browse all graphs for each N, paginated, with jump-to-id.
- Draw each graph with its **original edges** or as the **complete graph**
  K<sub>N</sub>.
- **Edge weight** from a pair observable such as MI. Colour and width are
  normalised per graph, over all graphs with the same N, or over all N.
- **Node colour** from per-node observables, and per-graph scalars shown in
  the detail view (once such data is available).
- Detail view with statistics for every observable, the graph6 code, and
  ← / → navigation between graphs.
- **Shareable links:** the URL always encodes the current view, including an
  open graph.
- **Export** a graph as SVG, PNG or JSON (the graph with all its values).
- Light and dark themes.

## Coverage

| N         | graphs  | layout | MI |
|-----------|--------:|:------:|:--:|
| 5–12      | 1,894   | ✓      | ✓  |
| 13        | 10,778  | ✓      | ✓  |
| 14        | 88,168  | ✓      | –  |
| 15        | 805,491 | –      | –  |

Graphs without a layout are drawn on a circle. Missing observables are marked
in the viewer.

## Running locally

It's a static site with no build step. Serve the repository root over HTTP:

```sh
python3 -m http.server
# open http://localhost:8000
```

Opening `index.html` straight from disk (`file://`) doesn't work, because
browsers block ES modules and data fetches there.

## Data

The data is generated in a separate pipeline. This repository contains only
the packed, web-ready form in `data/`, plus the tool that produces it.

```
data/manifest.json          graph counts per N, available layers, layer metadata and value ranges
data/N{N}/graphs-{k}.txt    graph6 strings, one per line
data/N{N}/layout-{k}.bin    int16 node positions
data/N{N}/{layer}-{k}.bin   float32 observable values (NaN = missing)
```

Files are sharded by 4096 graphs: shard `k` holds ids `4096·k … 4096·k+4095`.
The viewer fetches only the shards it needs. Pair observables store
n(n−1)/2 values per graph in graph6 upper-triangle order: (0,1), (0,2),
(1,2), (0,3), …

### Packing new data

Put the pipeline output in `raw/` (not tracked by git):

```
raw/zoo.csv               N,id,graph6 — ids 0..count-1 within each N
raw/layout_N{N}.json      [id] → [[x, y], …]
raw/{layer}_N{N}.json     [id] → values (pair: n(n−1)/2, node: n, graph: a single number)
raw/layers.json           optional definitions of extra layers
```

Then run the packer with [uv](https://docs.astral.sh/uv/). It declares its own
dependencies, so no environment setup is needed:

```sh
uv run tools/pack.py           # raw/ → data/
uv run tools/pack.py --check   # verify data/ against raw/
```

To add an observable, write `raw/{name}_N{N}.json` and describe the layer in
`raw/layers.json`:

```json
{ "s1": { "kind": "node", "label": "Single-site entropy", "short": "S1" } }
```

`kind` is `pair` (edge weight), `node` (node colour) or `graph` (a scalar in
the detail view). An optional `zeroThreshold` treats values at or below it as
zero: those edges are not drawn and are left out of per-graph scaling. After
re-packing, the new layer appears in the viewer's controls.

## Development

```sh
npm test    # unit tests (node --test, no dependencies)
```

- `index.html` and `css/zoo.css` hold the page and its theme tokens.
- `js/` contains the plain ES modules:
  - `data.js`: the manifest, shard loading and caching
  - `render.js`: SVG drawing
  - `url.js`: permalinks
  - `export.js`: downloads
  - `ui/`: the gallery, the detail view and the controls
- `tools/pack.py` is the data packer.

---

© 2026 Grzegorz Czelusta
