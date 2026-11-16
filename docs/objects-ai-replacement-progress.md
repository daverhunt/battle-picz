# Objects AI artwork replacement — status

Last updated: 2026-11-16. **Image generation reached 100 candidates. Deployment is NOT complete.**

## What exists

- 100 candidate AI-made object pictures have been assembled as WebP files (384×384) in the ChatGPT conversation's downloadable ZIP and phone-friendly 17-page PDF. These file binaries are **not committed to this repository**.
- A reproducible composition allocation is committed in `docs/objects-ai-compositions.json`: 35 centred, 25 horizontal offsets, 25 vertical offsets, 15 diagonal/corner. The exported images are candidate compositions and must be checked against this allocation visually; automatic positioning metadata is not proof.
- Several inaccurate / artefact-ridden generated sheets were rejected, and replacements were found for 100 answer IDs. A few images from number-labelled sheets still need manual polishing before shipment, especially Dustpan, Peg, Kite and Picnic Basket. No external photo provenance has been altered.
- Source-backed Wikimedia photo import automation was disabled to prevent accidental introduction of new third-party photographs.

## Live state (unchanged)

- Supabase: 100 active Objects questions, 0 marked as generated.
- Production currently serves the legacy photos. This is **not yet** an AI-only Objects release.
- Existing question IDs, answer strings, image paths and all active player matches remain intact.

## Required release sequence

1. Finish the remaining visual QA and touch-ups, including no labels, badges or unintentionally cropped objects.
2. Upload each replacement WebP **to its existing** `assets/images/categories/objects/<slug>.webp` path on a staging branch. No ID changes.
3. Verify 100 uploaded images and matching hashes. Check that client picture loading, same-match image and seeded grid remain stable for both players.
4. Only after the binary image assets are available, mark the Objects entries generated in Supabase and clear obsolete external-source credit metadata. Do not prematurely change metadata.
5. Publish to the main Vercel deployment and verify actual game rendering.

**Do not claim this image conversion is published until step 5 is complete.**
