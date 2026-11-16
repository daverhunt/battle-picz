# Pic Rivals artwork and store-release rules

## Generated artwork (all categories)

Every newly published category illustration must be originally AI-generated for Pic Rivals. No third-party photos or scraped image sources. Do not display image-origin attribution or an "AI-generated" caption during gameplay. Avoid third-party logos, trademarked product packaging, existing characters and visually copied artworks. The existing licensed assets remain flagged for replacement; do not mislabel them as generated.

### Compositions within each completed category

Assign the following composition presets **before generating** a category, using a seeded, reproducible shuffle of picture IDs, not generation order.

- **35% centred**: subject occupies the middle region.
- **25% horizontal offset**: split between left and right.
- **25% vertical offset**: split between upper and lower.
- **15% diagonal/corner or unusual angles**: split between corners/diagonals.

For a 100-image category: 35 centred; 25 horizontal; 25 vertical; 15 diagonal. The subject must be recognisable even after cropping/reveal, with meaningful object detail distributed across the full frame; avoid excessive blank space. Avoid strategic clues such as text, labels, logos or unintentional second objects. All questions retain their current IDs, answers, difficulty and point values.

### Quality gates

- Check all files exist and decode at the expected dimensions.
- Visually inspect subjects and their intended answer (no wrong objects).
- Verify composition allocations by the recorded preset. Do not count a prescribed preset as visual proof: inspect the actual output.
- Check both opponents receive the same picture, reveal grid and seeded letters within a match.
- Preserve ongoing round snapshots and established picture paths until replacement files are verified. Publish no broken image paths.
- No AI-origin or owner attribution displayed in-game.

## Store readiness

Build actual Android and iOS apps from the same game client with tested native deep links, authentication return flow and push notifications. PWA manifest alone is **not** an Android App Bundle or an iOS App Store package. Keep the live Vercel version running while native builds are tested.

Prepare Google Play internal testing and Apple TestFlight together. For newly created personal Google Play developer accounts, plan for 12 closed testers opted in for 14 continuous days before production access can be requested. Register official in-app consumable coin packs in both stores; validate store transactions **server-side** and grant coins idempotently before declaring purchases ready. Client UI alone must not credit coins.

Pre-release blockers include complete 2-player game tests, stable Google sign-in on both OSes, expected push/deep-link destinations, account deletion and privacy/data declarations, asset provenance, store screenshots, icons, age ratings and store-review credentials.
