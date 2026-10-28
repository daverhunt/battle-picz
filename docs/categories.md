# Categories and coin unlocks

Four categories are free: Animals, Food & Drink, Everyday Objects, Transport. Eight are permanent coin unlocks. The first paid unlock costs 15 coins; later packs cost 20–30. Only the chooser needs ownership. Existing opponents can always play a dealt round.

The server locks the buyer's profile, checks balance and availability, debits coins and grants ownership in one transaction. Repeat purchase requests are idempotent. Clients cannot write entitlements, prices or history.

Round configuration stores the exact three question snapshots. Both players use those snapshots. Pictures unseen by either player are preferred, then the least recently used by either player, with random tie breaks. Deals reserve history immediately; an invited opponent's history is recorded when they join. This conservatively counts deals that are never played. Existing legacy rounds retain their seeded order.

Only the current round is preloaded. The first image has priority; the others download in the background. The app does not deliberately maintain a permanent image cache.

The shop displays actual active picture counts and blocks packs with fewer than three pictures. The content target remains 100 distinct answers per category, then 200–300 for popular packs. Starter content is not represented as a completed 1,200-picture catalogue.

Validation: `node --test tests/*.test.js`; `tests/categories.integration.sql` runs transaction-only two-player fixtures and rolls them back. It verifies ownership checks, insufficient funds, idempotent purchases, immutable shared deals, unseen-picture selection, late-join history and free opponent play.

Release catalogue: 95 pictures total (30 original and 65 new). Counts: OBJECTS 7, TRANSPORT 6, LANDMARKS 5, MUSIC 8, PLANTS 8, TOOLS 6, JOBS 8, SPACE 7, CLOTHING 10. Three unsuitable candidates were excluded during visual review. New assets are bundled WebP files with source, author, licence and modification metadata.

Approved generated Animals batch (25 October 2026): ten new distinct answers, bringing Animals to 20 and the catalogue to 105. Provenance is in `generated-animal-pictures.json`. Deploy the bundled assets before applying `scripts/seed-approved-animals.sql`. Original seeded banks stay unchanged so legacy rounds remain reproducible.

### Animals expansion: 100 pictures

80 additional AI-generated animal pictures approved on 2026-10-25. Combined with the original 10 and first approved 10, Animals has 100 active pictures after applying `scripts/seed-approved-animals-80.sql`. Assets are 800px WebP. Existing round snapshots and legacy question banks are unchanged.
