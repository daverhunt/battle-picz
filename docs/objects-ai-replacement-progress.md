# Objects AI replacement — strict visual QA

Updated 2026-11-16. **Unreleased:** none of the new AI candidate binary images have been committed to GitHub or deployed to Vercel.

## Current work completed in ChatGPT

- Audited the 100-image staged ZIP against the 100 Objects answer labels and visually inspected the five 20-image contact sheets.
- Corrected **23 additional assets during the newest cleanup pass**, including the obvious panel-border artefacts for Envelope, Fork, Grater, Hanger, Headphones, Iron, Jigsaw, Kettle, Lamp, Laptop, Microphone, Mouse, Mug, Pencil, Plate and Plunger, plus full-length Broom, Egg Cup with an egg, Plant Pot, Stapler, Toilet Roll, Toaster and Torch.
- These 23 are additional to 10 earlier corrected assets: Paintbrush (previously incorrectly showing pliers), Stamp, Tablet, Teddy Bear, Telephone, Peg, Kite, Picnic Basket, Dustpan and Paperclip.
- Prepared a 100-file draft ZIP with these replacements. The ZIP was decoded and hash-checked: 100 unique 384×384 WebP files, all filenames and SHA-256 hashes matching its internal manifest.
- **Six remaining visible rejects** after the update: Ruler, Soap, Toothbrush, Toothpaste, Towel, Watering Can. Cleanups were attempted without new image generation but visual checks still showed defects (stray characters, edges, insufficient image quality). Do **not** mark these approved or ship the draft ZIP.
- The remaining objects are candidates, not certified game-ready until the final whole-category visual check is passed. The 35/25/25/15 compositions are assigned in `docs/objects-ai-compositions.json`; assignment is not evidence of actual composition.
- No licensed photos were overwritten in the production repository; no Supabase generated flags or player-match data changed.

## Blockers before release

1. Regenerate the six rejects as clean high-resolution AI illustrations without words, border lines or clipped silhouettes.
2. Visually recheck the complete 100 at game viewport size and audit any remaining ambiguous subject-image mapping.
3. Publish the exact 100 verified WebP files under their existing `assets/images/categories/objects/<slug>.webp` paths, preserving all IDs and answers.
4. Verify staged hashes, two-player seeded grid agreement, and that Supabase continues to resolve 100 active Objects answers.
5. Only then update Supabase `generated:true` and remove superseded owner/attribution fields. No attribution should appear in gameplay.

**Don't report 100 AI images as live until all five steps have succeeded.**
