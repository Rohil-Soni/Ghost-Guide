# 👻 Ghost Guide — JUET Campus Accessibility & Facility Map (PS14)

A three.js site for the JUET Guna campus with two modes:

- **Story mode:** a scroll-driven camera tour (GSAP ScrollTrigger + Lenis) with a little ghost guide.
- **Explore mode:** a free map (MapControls) with fuzzy search (Fuse.js), HTML pins, layer filters, a detail panel with an accessibility card, a building directory, and A* walking directions with a **step-free only** option.

The full design lives in [GHOST_GUIDE_PLAN.md](GHOST_GUIDE_PLAN.md).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, works on GitHub Pages)
npm run validate   # cross-check locations / chapters / nav / GLB names
```

Useful URLs: `/?mode=explore` skips the tour, and `/#/loc/annapurna` deep-links to a building.

## Where things are

| Path | What |
|---|---|
| `public/data/locations.json` | Every building/area: names, aliases, category, rooms, accessibility, anchor |
| `public/data/chapters.json` | Tour chapters (text + camera shot) |
| `public/data/nav.json` | Walking graph (nodes, edges, `stairs` / `unpaved` flags) |
| `public/data/shots.json` | Output of `tools/export_shots.py`; overrides hand-written shots and anchors |
| `src/core/` | Renderer, scene loading/highlight, CameraRig (sole camera owner), placeholder campus |
| `src/story/` | TourPath (Catmull-Rom curves + hold logic), ScrollEngine, chapter cards, ghost mascot |
| `src/explore/` | Pins (CSS2DRenderer + declutter), Picking, Router (A*), RouteLine |
| `src/ui/` | Search combobox, Directory, detail Panel, Loader |
| `tools/` | Blender export scripts and the data validator |

## Placeholder campus → real model

Until `Jaypee_Map.blend` is cleaned up, the site draws a **procedural stand-in** (`src/core/ProceduralCampus.js`). Its roads, lake and buildings are traced from the current model's top-down footprint, in Blender coordinates. As soon as `public/models/campus.opt.glb` exists, it is loaded instead, with no code changes:

1. Follow the clean-up checklist in plan §8.2 and name clickable objects `LOC_<id>`, matching the ids in `locations.json` (e.g. `LOC_annapurna`, `LOC_hostel_h07`). Parent multi-part buildings under an empty with that name.
2. Export a glTF (.glb) as `campus.glb` in the repo root (+Y up, apply modifiers, no cameras/lights).
3. `npm run optimize`, then `npm run validate`.
4. Optional: drop a satellite or stylised ground image at `public/textures/campus-ground.webp` (used by the procedural campus), and a 2D map at `public/fallback/campus-2d.webp` (no-WebGL fallback).
5. Add `CAM_<id>` / `TGT_<id>` empties for nicer shots and run `tools/export_shots.py` inside Blender.

## Data still needed (plan §10)

Everything marked **draft** in the UI is a placeholder:

- Hostel block ↔ H-number mapping (no H13?), girls' hostel, library/LRC, admin, Tagore Hall, academic block names, LTs and labs: these are not on the map yet.
- Identity of `Cube.027` (`block_ne`), `Cube.028` (`block_central`) and the large hall (`hall_south`).
- **All accessibility fields are `null`** ("Not surveyed yet") until surveyed.
- `nav.json` stairs/unpaved flags on `n30–n16`, `n31–n22` and `n27–n24` are **samples** used to demo step-free routing.
- `metresPerUnit` (8.2) is an estimate. Replace it after the 3-point calibration (plan §2.2).
