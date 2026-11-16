# Objects AI artwork release — published

Published 2026-11-16.

## Release
- User-approved input: `pic-rivals-objects-artwork-qa-v8-UNRELEASED.zip` (historical archive filename; approved before publication)
- Archive SHA-256: `009c46ce7cdb3363728a1cebaf7e662d83ad9af094ea44387fc580380197b343`
- 100 individual AI-generated WebP assets were uploaded directly to GitHub under their pre-existing `assets/images/categories/objects/<slug>.webp` paths.
- All **100 GitHub Git blob SHA-1 hashes** were checked against hashes calculated directly from the exact approved archive: 100 matches, zero missing or changed.
- Image geometry and manifest SHA-256 values were checked locally for all 100: 384×384, all unique IDs and paths.
- Released on `main` at commit `6a902d5f757f34a0f9c9ba5d40501f14abc874db`; corresponding Vercel production deployment `dpl_DactzcAjRD1HvtuwL7CbJHGDckLY` reached READY and was aliased to `pic-rivals.vercel.app`.
- Legacy third-party photo attribution metadata was removed from Objects fallback `category-pictures.js` and from all 100 Supabase Objects `question` JSON records; `generated=true` set on all 100.
- Supabase post-update check: total 100, active 100, generated 100, old attribution 0, malformed image paths 0.
- Existing question IDs, answer strings, paths, matches and round snapshots were **not modified**.

## Visual acceptance and follow-up

The user explicitly approved the v8 gallery for publishing. The archived draft manifest still listed eight earlier quality-control warnings (Ruler, Soap, Toaster, Toothbrush, Toothpaste, Torch, Towel, Watering Can); these were accepted in the v8 approval, not regenerated as part of the upload. This release proves byte identity and deployment, not that 100 live game rounds were individually played through.

Recommended smoke test: open the live Objects category on an iPhone, play a two-player round, check images and seeded tile layout match across both accounts; verify `EGG CUP`, `TOILET ROLL` and other multiple-word answers have gaps. Report any residual individual image quality concerns by name for targeted replacement.

## Policy
All future category artwork must be AI-generated. No in-game attribution. The previously approved 35% centered / 25% horizontal / 25% vertical / 15% diagonal subject-positioning allocation remains documented in `docs/objects-ai-compositions.json`. Its quotas are a generation intention, not an automatically verified final geometric distribution.
