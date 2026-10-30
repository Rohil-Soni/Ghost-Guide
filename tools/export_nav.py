# Run inside Blender. Builds public/data/nav.json from empties:
#   NAV_<n>         footpath / road junction
#   ENT_<locId>_<n> building entrance (also a nav node)
# Edges come from a custom property "links" on each empty: comma-separated names of the
# empties it connects to, e.g. "NAV_002,ENT_annapurna_1". Optional custom props
# "stairs" and "unpaved" list the subset of those links that have steps / are unpaved.
import bpy, json, os

OUT = bpy.path.abspath("//ghost-guide/public/data/nav.json")
METRES_PER_UNIT = 8.2  # update after the 3-point calibration (plan §2.2)


def to_three(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


def key(name):
    return name.lower()  # NAV_017 -> nav_017, ENT_annapurna_1 -> ent_annapurna_1


def names(o, prop):
    return [s.strip() for s in str(o.get(prop, "")).split(",") if s.strip()]


nodes, edges, seen = {}, [], set()
objs = [o for o in bpy.data.objects if o.name.startswith(("NAV_", "ENT_"))]
for o in objs:
    nodes[key(o.name)] = to_three(o.matrix_world.translation)
for o in objs:
    stairs, unpaved = set(names(o, "stairs")), set(names(o, "unpaved"))
    for other in names(o, "links"):
        if other not in bpy.data.objects:
            print("WARNING: unknown link", o.name, "->", other)
            continue
        pair = tuple(sorted((key(o.name), key(other))))
        if pair in seen:
            continue
        seen.add(pair)
        flags = {}
        if other in stairs: flags["stairs"] = True
        if other in unpaved: flags["unpaved"] = True
        edges.append([pair[0], pair[1], flags])

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump({"metresPerUnit": METRES_PER_UNIT, "nodes": nodes, "edges": edges}, f, indent=1)
print("exported", len(nodes), "nodes,", len(edges), "edges ->", OUT)
