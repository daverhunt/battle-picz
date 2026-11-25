# Picture selection rules (all Pic Rivals categories)

## Catalogue
- Each picture is an independent record with a stable `id`, `category_id`, answer `question.a`, display label, and distinct image path.
- Several pictures **may share an answer**, in the same category or across categories, provided the pictures are meaningfully different.
- The image path must be unique within its category. Never recycle a picture ID for a different picture.
- Normalize answers for comparisons by trimming, uppercasing and removing non-alphanumeric characters: e.g. `ICE CREAM`, `ICE-CREAM` and `icecream` are the same answer.
- A playable category must contain at least three **different normalized answers**, regardless of how many total images it has.
- Picture selection cannot fix confusing images; reviewers should continue to reject visually ambiguous or obscure prompts.

## Three-picture round
1. The server finds **distinct answers** in the selected category.
2. It chooses three different answers. Recent use by **either player** is avoided when enough alternatives exist.
3. For each answer, it chooses one image variant, prioritizing images the players have seen less recently and less often.
4. The server saves the three selected picture records (including their IDs and image paths) in the round's immutable `game_config.rounds[N].questions` deal.
5. The same three pictures and order are presented to both players, even if the category catalogue changes later.
6. The server reserves the chosen pictures in per-player `picture_history` to improve freshness across other matches.

## Compatibility
- Previously dealt rounds, including their image variants, must never be reshuffled.
- Existing old-format online rounds without saved question IDs retain their historical seeded fallback.
- New local/offline rounds use a seeded two-stage answer/variant picker.
- Three distinct answers are mandatory; if a category has fewer, report it as not ready instead of repeating an answer.

## Examples
- Valid catalogue: TREE (oak tree), TREE (snow-covered tree), TREE (palm), LEAF, WATERFALL.
- Valid round: TREE, LEAF, WATERFALL.
- Invalid round: TREE, TREE, LEAF.
