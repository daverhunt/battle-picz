# Objects AI artwork replacement — current status

Updated 2026-11-16. **This is a work-in-progress, not a completed release.**

- 100 active Objects entries and their existing question IDs remain intact in Supabase.
- Exact composition assignments for all 100: `docs/objects-ai-compositions.json` (35 centered / 25 horizontal / 25 vertical / 15 diagonal).
- Existing licensed-photo auto-import is disabled at `.github/workflows/fetch-objects.yml`.
- A first 32 AI-generated replacement candidates have been created and visually reviewed in ChatGPT, with original subject names. They **are not committed into GitHub and are not live**. Their artwork PDF and ZIP are conversation artifacts.
- An additional 36 provisional extracted candidate images require cleanup because the generated grids contain numbered labels, crop artefacts, or poor framing.
- 32 Objects still lack exact-match, good-quality generated pictures: egg cup, funnel, glue stick, hairdryer, hammock, jug, keyboard, ladle, mirror, mop, nail clippers, peeler, pen, pillow, radio, razor, rolling pin, rubber band, rug, sharpener, sieve, sofa, spinning top, sponge, stool, teapot, tent, tongs, tweezers, vase, washing machine, yo-yo.
- **Do not** declare the 100-image conversion finished or set `question.generated=true` until all 100 new binary WebP assets are committed at their existing paths and verified on Vercel.
- Do not erase provenance fields of the still-live licensed images just to change appearances or metadata. Compliance changes should coincide with replacing the files.
- Maintain the existing fixed picture-ID mappings for each game round; never rewrite active match snapshots to new IDs.

## Acceptance checks before publication

1. All 100 exact-match image files must exist, decode, and be recognisable without printed words or numbered badges.
2. Each composition must match the assignment and subject must remain inside frame; inspect actual geometry, not only assigned labels.
3. All 100 paths and current question IDs must remain unchanged; completed active matches are not mutated.
4. Verify both players receive identical assets, tiles and letters within the same round.
5. Compare image URLs in production and confirm the actual bytes are the replacement images, not cached licensed copies.
6. Perform a 2-player gameplay smoke test; confirm the Objects active count stays 100.
7. Once all checks pass, update Supabase question provenance to `generated:true` and remove third-party credit fields for replaced entries, then confirm no attribution renders in gameplay.
