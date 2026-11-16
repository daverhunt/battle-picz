# Objects AI artwork replacement — current status

Updated 2026-11-16. **Work in progress: no candidate replacement assets have been committed or deployed.**

## Verified game state
- Supabase: 100 active Objects questions; none currently marked generated.
- Existing picture IDs and paths unchanged. Player matches and round snapshots unchanged.
- Source-photo importer disabled (`.github/workflows/fetch-objects.yml`).
- Exact approved composition distribution for the 100 objects recorded in `docs/objects-ai-compositions.json`: 35 centered, 25 horizontal offsets, 25 vertical offsets, 15 diagonal/corner.

## Image production
- **48 AI-generated candidate WebP illustrations** have been produced in the current ChatGPT task. This includes the original 32 cleaner candidates plus 16 new exact-answer candidates: Egg Cup, Funnel, Glue Stick, Hairdryer, Hammock, Jug, Keyboard, Ladle, Mirror, Mop, Nail Clippers, Peeler, Pen, Pillow, Radio and Razor.
- The 48 candidates are in a conversation-attachment ZIP and 8-page phone-friendly review PDF, **not in this GitHub repository**. Do not mistake this metadata record for a deployment.
- 52 Objects still require exact-match quality-assured images: Dustpan, Envelope, Fork, Grater, Hanger, Headphones, Iron, Jigsaw, Kettle, Kite, Lamp, Laptop, Microphone, Mouse, Mug, Paintbrush, Paperclip, Peg, Pencil, Picnic Basket, Plant Pot, Plate, Plunger, Rolling Pin, Rubber Band, Rug, Ruler, Sharpener, Sieve, Soap, Sofa, Spinning Top, Sponge, Stamp, Stapler, Stool, Tablet, Teapot, Teddy Bear, Tent, Toaster, Toilet Roll, Tongs, Toothbrush, Toothpaste, Torch, Towel, Tweezers, Vase, Washing Machine, Watering Can, Yo-Yo.
- Some additional raw image sheets were excluded due to incorrect object matches, labels or cropping.

## Acceptance and release checklist

1. Complete all 100 original, brand-free, watermark-free AI illustrations with clear distinctive objects.
2. Visually check actual subject placement as well as preset quotas (35/25/25/15). A composition label is not proof of output.
3. Verify every WebP decodes, correct file name/answer, and original ID/path remain unchanged.
4. Replace binary assets on a staged GitHub branch, not by altering existing match snapshot data.
5. Test a full two-player match and confirm both players see identical images, reveal-grid and seeded letters.
6. Confirm deployment bytes match replacements, not cached old pictures.
7. Only after production asset validation, change Supabase provenance to `generated: true` and remove third-party source/artist/licence fields. Do not remove lawful source metadata before the actual licensed artwork is gone.
8. In gameplay, show the category label, not origin or attribution.

**Publishing condition:** Until all checks pass, the live 100 Objects picture bank remains intact. Do not claim the AI conversion is complete.
