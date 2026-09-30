#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.10"
# dependencies = ["numpy"]
# ///
"""Pack pipeline output into the sharded web format served from data/.

Input (--src, default raw/):
    zoo.csv                 N,id,graph6 — one row per graph, ids 0..count-1 per N
    layout_N{N}.json        [id] -> [[x,y], ...]              (n points)
    {layer}_N{N}.json       [id] -> [v, ...]                  per LAYERS[layer]["kind"]:
                               pair: n(n-1)/2 values, graph6 upper-triangle order
                               node: n values;  graph: a single number
    layers.json             optional: extra layer definitions merged into LAYERS,
                               e.g. {"s1": {"kind": "node", "label": "Single-site entropy", "short": "S1"}}

Output (--out, default data/):
    manifest.json
    N{N}/graphs-{k}.txt     graph6 strings, one per line, ids k*S .. k*S+S-1
    N{N}/layout-{k}.bin     int16 LE, n*2 per graph, x/32767*scale; missing graph = all -32768
    N{N}/{layer}-{k}.bin    float32 LE, fixed width per graph; missing graph = NaN

Usage:
    uv run tools/pack.py                  pack everything found in raw/
    uv run tools/pack.py --check          verify data/ against raw/ (sampled)
"""
import argparse, csv, json, math, random, shutil, sys
from collections import defaultdict
from pathlib import Path

import numpy as np

SHARD = 4096
LAYOUT_MISSING = -32768

# Observable layers known to the viewer. Add an entry here (or in {src}/layers.json)
# when the pipeline produces a new {layer}_N{N}.json; the viewer picks it up from
# the manifest. Keys: kind (pair|node|graph), label, short, zeroThreshold (optional:
# values at or below it count as zero — not drawn, excluded from per-graph scale).
LAYERS = {
    "mi": {"kind": "pair", "label": "Mutual information", "short": "MI",
           "zeroThreshold": 1e-10},
}


def width(kind, n):
    return {"pair": n * (n - 1) // 2, "node": n, "graph": 1}[kind]


def read_catalogue(path):
    byN = defaultdict(list)
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            byN[int(row["N"])].append((int(row["id"]), row["graph6"].strip()))
    for N, rows in byN.items():
        rows.sort()
        ids = [i for i, _ in rows]
        if ids != list(range(len(ids))):
            sys.exit(f"zoo.csv: ids for N={N} are not contiguous 0..{len(ids)-1}")
    return {N: [g for _, g in rows] for N, rows in sorted(byN.items())}


def load_json(path):
    print(f"  reading {path.name} ({path.stat().st_size/1e6:.1f} MB)", flush=True)
    with open(path) as f:
        return json.load(f)


def to_matrix(entries, count, w, name):
    """list of per-graph lists -> (count, w) float64 array, NaN rows where missing"""
    if len(entries) > count:
        sys.exit(f"{name}: {len(entries)} entries but only {count} graphs")
    out = np.full((count, w), np.nan)
    bad = 0
    for i, e in enumerate(entries):
        if isinstance(e, (int, float)) and w == 1:
            e = [e]
        if isinstance(e, list) and len(e) == w:
            out[i] = e
        else:
            bad += 1
    if len(entries) < count:
        print(f"  warning: {name} covers only ids 0..{len(entries)-1} of {count}")
    if bad:
        print(f"  warning: {name}: {bad} malformed entries stored as missing")
    return out


def denoise(a):
    """tiny negative values (~-1e-14) are round-off in the MI computation"""
    return np.where((a < 0) & (a > -1e-9), 0.0, a)


def shards(count):
    return range(math.ceil(count / SHARD))


def layer_defs(src):
    defs = dict(LAYERS)
    extra = src / "layers.json"
    if extra.exists():
        defs.update(json.loads(extra.read_text()))
    for name, meta in defs.items():
        if meta.get("kind") not in ("pair", "node", "graph") or name in ("layout", "graphs"):
            sys.exit(f"layer {name!r}: bad name or kind")
    return defs


def pack(src, out):
    graphs = read_catalogue(src / "zoo.csv")
    layers = layer_defs(src)
    manifest = {"version": 1, "shardSize": SHARD, "N": {}, "layers": {}}
    layer_meta = {k: dict(v, range={}) for k, v in layers.items()}

    for N, g6 in graphs.items():
        count = len(g6)
        print(f"N={N}: {count} graphs", flush=True)
        d = out / f"N{N}"
        if d.exists():
            shutil.rmtree(d)
        d.mkdir(parents=True)
        entry = {"count": count, "layers": []}

        for k in shards(count):
            (d / f"graphs-{k}.txt").write_text("\n".join(g6[k*SHARD:(k+1)*SHARD]) + "\n")

        lp = src / f"layout_N{N}.json"
        if lp.exists():
            xy = to_matrix(flatten_layouts(load_json(lp)), count, 2 * N, lp.name)
            scale = float(np.nanmax(np.abs(xy))) or 1.0
            q = np.where(np.isnan(xy), LAYOUT_MISSING,
                         np.round(np.nan_to_num(xy) / scale * 32767)).astype("<i2")
            for k in shards(count):
                q[k*SHARD:(k+1)*SHARD].tofile(d / f"layout-{k}.bin")
            entry["layoutScale"] = scale
            entry["layers"].append("layout")

        for name, meta in layers.items():
            p = src / f"{name}_N{N}.json"
            if not p.exists():
                continue
            m = to_matrix(load_json(p), count, width(meta["kind"], N), p.name)
            m = denoise(m)
            if np.any(m < 0):
                print(f"  note: {p.name} has genuinely negative values (min {np.nanmin(m):.3g})")
            f = m.astype("<f4")
            for k in shards(count):
                f[k*SHARD:(k+1)*SHARD].tofile(d / f"{name}-{k}.bin")
            layer_meta[name]["range"][str(N)] = [float(np.nanmin(m)), float(np.nanmax(m))]
            entry["layers"].append(name)

        manifest["N"][str(N)] = entry

    manifest["layers"] = {k: v for k, v in layer_meta.items() if v["range"]}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n")
    print(f"wrote {out/'manifest.json'}")


def flatten_layouts(entries):
    return [[c for pt in e for c in pt] if isinstance(e, list) else None for e in entries]


def check(src, out, samples=200):
    manifest = json.loads((out / "manifest.json").read_text())
    graphs = read_catalogue(src / "zoo.csv")
    S = manifest["shardSize"]
    ok = True

    def fail(msg):
        nonlocal ok
        ok = False
        print("  FAIL", msg)

    for N, g6 in graphs.items():
        e = manifest["N"].get(str(N))
        if not e or e["count"] != len(g6):
            fail(f"N={N}: count mismatch")
            continue
        ids = random.Random(N).sample(range(len(g6)), min(samples, len(g6)))
        print(f"N={N}: checking {len(ids)} ids", flush=True)
        d = out / f"N{N}"
        for i in ids:
            lines = (d / f"graphs-{i//S}.txt").read_text().split("\n")
            if lines[i % S] != g6[i]:
                fail(f"N={N} id={i}: graph6 differs")
        if "layout" in e["layers"]:
            src_l = load_json(src / f"layout_N{N}.json")
            for i in ids:
                q = np.fromfile(d / f"layout-{i//S}.bin", "<i2").reshape(-1, 2 * N)[i % S]
                got = q / 32767 * e["layoutScale"]
                if not np.allclose(got, np.ravel(src_l[i]), atol=1e-4 * e["layoutScale"]):
                    fail(f"N={N} id={i}: layout differs")
        for name in e["layers"]:
            if name == "layout":
                continue
            w = width(manifest["layers"][name]["kind"], N)
            src_v = load_json(src / f"{name}_N{N}.json")
            for i in ids:
                got = np.fromfile(d / f"{name}-{i//S}.bin", "<f4").reshape(-1, w)[i % S]
                want = denoise(np.ravel(np.asarray(src_v[i], dtype=float)))
                if not np.allclose(got, want, rtol=1e-6, atol=1e-9):
                    fail(f"N={N} id={i}: {name} differs")
    print("OK" if ok else "CHECK FAILED")
    return ok


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=Path("raw"))
    ap.add_argument("--out", type=Path, default=Path("data"))
    ap.add_argument("--check", action="store_true", help="verify packed data against sources")
    a = ap.parse_args()
    if a.check:
        sys.exit(0 if check(a.src, a.out) else 1)
    pack(a.src, a.out)


if __name__ == "__main__":
    main()
