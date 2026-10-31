# JUET Guna Campus Places – Starter Dataset

This package contains 12 starter campus destinations for a JUET Guna campus guide or navigation project.

## Files

- `juet_campus_places.json` – structured data with descriptions, aliases, buildings/areas, nearby-place IDs, evidence notes, coordinate placeholders and source records.
- `juet_campus_places.csv` – flat version for spreadsheets, quick review or import into a simple database.
- `juet_campus_relationships.csv` – relationship/edge table for a graph, map or navigation system.

## Suggested schema use

Use `id` as the stable primary key. Use `aliases` for search matching. Use `nearby_place_ids` and the relationships CSV to show nearby destinations. Keep coordinates as `null` / `N/A` until someone captures the real point on campus. Never geocode a building by searching only the university's postal address; that would put every pin at the same campus-level point.

## Important verification notes

1. LT-1 is explicitly listed as `LT-1, Ramanujan Bhavan` in JUET's PGET-2025 instructions.
2. JUET's 2026 Admission Brochure places the LRC in Vishvesvaraya Bhawan.
3. JUET's official virtual-tour index lists the Main Gate, Nehru Plaza, academic-block viewpoints, LT-2 to LT-5, Registrar/VC offices, LRC, Cafeteria, Annapurna, MPH, Sports Ground, Boys Hostel, Girls Hostel and the main-road/mess-pathway wording.
4. The Nehru Plaza to Tagore Hall/MPH and Sports Ground relationships are sourced from JUET's 2020-21 AQAR, so treat them as broad nearby relationships and verify the current walking route.
5. LT-2 to LT-5 are grouped as one provisional search target. They should become four individual records after each theatre entrance and building assignment is confirmed.
6. The administrative offices are grouped for convenience; verify whether the listed offices share a building before placing one map pin.
7. No per-place GPS coordinates were established from the public sources used here. All coordinate fields are intentionally empty.

## Suggested on-campus data collection

For each destination, collect: (a) GPS point at the public entrance, (b) a photo of the sign/entrance, (c) building name and floor, (d) nearest visible landmark, (e) walking connection to the next destination, and (f) the name students actually use. For LT-2 to LT-5 and the administrative offices, collect separate pins instead of using a cluster centroid.
