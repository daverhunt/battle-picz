# Objects AI replacement — quality-control status

Updated 2026-11-16. **Staged only: no AI artwork binary files have been published to GitHub or Vercel.**

## Inventory

- All 100 active Objects questions retain their existing IDs, answers and image paths in Supabase. Zero remain marked AI-generated in the live database.
- A 100-image draft candidate pack exists as a ChatGPT conversation artifact. It must not be treated as a published set.
- A **new 100-image draft ZIP (v3)** replaced 10 faulty candidate assets:
  `paintbrush`, `stamp`, `tablet`, `teddy-bear`, `telephone`, `peg`, `kite`, `picnic-basket`, `dustpan`, `paperclip`.
- The user's wrong-picture report was confirmed: the previous `paintbrush.webp` showed **pliers**. The replacement now shows a paintbrush.
- The old stamp had unwanted text and the teddy bear, peg, kite and picnic basket were poorly cropped; the updated images show the intended objects without the old visible border artifacts. A two-page phone-friendly correction PDF is available as a ChatGPT conversation artifact.
- **Broom remains flagged**: existing candidate has a clipped handle. Other provisional images also require inspection for foreign objects, cut-off silhouettes or borders (particularly envelope, fork, hanger, lamp, microphone, mouse, ruler, toothpaste and towel).
- The 35/25/25/15 composition plan remains in `docs/objects-ai-compositions.json`; a preset alone does not guarantee every actual image uses that composition.
- The former Commons third-party-photo importer is disabled.

## Multiword answers

The production `index.html` implementation contains `answerLetters()` which excludes spaces from selectable tiles and `answer-gap` for visible separation, supporting `EGG CUP`, `TOILET ROLL` and other multiword entries. This should still be tested on a real two-player round before release.

## Publication gate

1. Regenerate/correct all known rejected image candidates and visually inspect all 100 at full game size, including off-centre subjects.
2. Ship the 100 verified WebP files to **existing** `assets/images/categories/objects/<slug>.webp` paths on a staging branch; check paths, counts and decoded image sizes.
3. Verify a real two-player match with shared images/reveal layout; compare staged and production asset hashes.
4. Publish the image assets to main only after QA; then update Supabase `question.generated=true` and remove superseded external source/artist/licence fields.
5. Confirm the 100 live Objects questions all resolve to the replacement AI artwork, and the category name remains visible with **no image attribution**.

**Do not claim completion until the new image files are in GitHub, live and verified.**
