# Technology category — revised 80-image release

- All **80** revised, recognisable, physical-object Technology images are committed under `assets/images/categories/technology/`.
- The manifest `docs/technology-picture-manifest.json` contains exactly the same 80 image paths and IDs.
- `category-pictures.js` supplies the 80 image records to the game client.
- Server migration: `supabase/migrations/20261125190000_technology_category_80.sql` (20-coin unlock).
- The global round selector chooses three different answers, retaining shared images for each player.
- Abstract candidates (such as AI, Cloud, Website, Coding, Data and Metaverse) were excluded.

Release checks: merge to main, verify 80 image URLs on production, then apply the migration. Verify 80 active entries in the database and three distinct answers per match.
