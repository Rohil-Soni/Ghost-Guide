# Run inside Blender (Scripting tab) with Jaypee_Map.blend open.
# Writes public/data/shots.json next to the repo: camera shots from CAM_<id>/TGT_<id> empties and
# anchors for every LOC_/ENT_/POI_/NAV_/VIA_ object. Blender Z-up -> three.js Y-up: (x, z, -y).
import bpy, json, os

OUT = bpy.path.abspath("//ghost-guide/public/data/shots.json")  # adjust if the repo lives elsewhere


def to_three(v):
    return [round(v.x, 3), round(v.z, 3), round(-v.y, 3)]


out = {"_anchors": {}}
for o in bpy.data.objects:
    if o.name.startswith("CAM_"):
        sid = o.name[4:]
        tgt = bpy.data.objects.get("TGT_" + sid)
        out[sid] = {
            "pos": to_three(o.matrix_world.translation),
            "target": to_three(tgt.matrix_world.translation) if tgt else None,
        }
    elif o.name.startswith(("LOC_", "ENT_", "POI_", "NAV_", "VIA_")):
        out["_anchors"][o.name] = to_three(o.matrix_world.translation)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w") as f:
    json.dump(out, f, indent=1)
print("exported", len(out) - 1, "shots and", len(out["_anchors"]), "anchors ->", OUT)
