# Technology: staged 80-picture release

This is an **unpublished** catalogue awaiting 80 individual WebP assets at `assets/images/categories/technology/`.

- 80 unique, reasonably familiar answers, curated from the Technology review sheets.
- Every picture has a stable `technology:<slug>` ID and a distinct `<slug>.webp` image filename.
- The game-wide selector supports more than one image per answer; it always deals three distinct answers.
- Users must not see Technology until all 80 images are actually committed and production URLs return valid WebP data.
- Assets package: `picrivals_technology_assets_80.zip`, generated with the conversation (not committed to GitHub yet).

## Publish sequence

1. Review the pictures; especially check AI/AR/Website/Smart Home against tile-reveal recognition.
2. Extract ZIP: copy `technology/*.webp` to `assets/images/categories/technology/*.webp`.
3. Validate all 80 image paths against `docs/technology-picture-manifest.json`.
4. Add technology questions to `category-pictures.js` (or regenerate the category catalogue) without rewriting legacy decks.
5. Merge changes, verify 80 production image URLs, then apply `supabase/migrations/20261125190000_technology_category_80.sql`.
6. Verify Supabase count of 80, list_categories response, and run a real two-player three-image round.

Nothing in this staging branch activates Technology in live matches.
