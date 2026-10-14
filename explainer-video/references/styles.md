# Styles

Three styles have been made so far. The template engine does cartoon and flat (set `style.outline` and `style.shadow` in `js/theme.js`, or `--style` when scaffolding). Collage needs the older engine.

Replace `<palette>` in the prompts below with the brand's colors from its profile, for example "deep navy #1B1F3B, indigo #2D3A8C, bright blue #4F6BED, warm yellow #FFC857 (small accents only), pale blue-gray #F4F6FB, white, light gray #D5DAE6".

## Cartoon (internal updates, fun)

- Look: outlined shapes (5 px ink outline), flat fills, soft offset shadow (ink at about 13 percent, 8 px down), rounded corners, big punchy outlined headline text (`K.bigText`) for punchlines.
- Motion: pop-ins with a small overshoot (`K.pop`), gentle bobbing, wiggles on problem moments, squash on landings, confetti only for the peak moment and the end card. No camera shake, no flashing.
- Characters: AI cartoon cut-outs; a recurring cast (a mascot for the AI assistant with a name tag, the protagonist, a colleague with a running visual gag).
- Sound: playful music (marimba, plucked guitar, pizzicato, light claps) at 112 BPM, cartoon effects (pop, boing, sneeze, record scratch, fanfare).
- Illustration style prompt:

> Playful 2D cartoon illustration in the style of a modern animated explainer series. Bold, rounded, simple shapes; clean, even <ink color> outlines of medium weight around every shape; flat colors with at most one soft shade; big expressive heads and large friendly eyes; simple bendy limbs; cheerful, funny, warm. Strict palette: <palette>, plus natural skin tones and natural hair colors. <colors to avoid>. Diverse adults, tall and friendly, not babies.

## Flat corporate (board and leadership audiences)

- Look: no outlines (`style.outline: 0`), white rounded cards with a soft blurred shadow (`style.shadow: 'soft'`), the brand's connection motif, icons from the brand library, generous white space.
- Motion: gentle fades and short slides, connectors that draw themselves, numbers that settle. No bounces.
- Characters: optional flat vector people (AI illustrations only with the user's go-ahead if the brand forbids an "AI look").
- Sound: calm, confident music (warm electric piano, muted guitar, light four-on-the-floor) under a credible voice; very few effects.
- Illustration style prompt:

> Modern flat vector illustration for a calm, professional corporate explainer video, in the style of contemporary editorial tech illustration: simple geometric shapes, smooth rounded corners everywhere, no outlines, flat colors with at most one subtle shade per color, no gradients, no texture, no grain, no 3D, no photorealism. Strict limited palette: <palette>, plus natural skin tones and natural hair colors only. People are stylized, friendly, diverse adults in business-casual clothes, with simple faces (small dot eyes, gentle smiles) and slightly elongated proportions. Optimistic, tidy, uncluttered.

## Paper collage (external marketing)

- Look: hand-drawn paper collage: kraft and paper textures, die-cut white edges with soft shadows, tape, stamps, stop-motion "boil" (2 to 3 drawings per second), torn-paper transitions, real geography for maps.
- Engine: not in the template yet (a good contribution). The first film used a separate canvas engine with paper textures, die-cut white edges with soft shadows on cut-outs, and Natural Earth geography for maps. The pipeline tools (voice, timing, mix, render, reviews) are the same as in the template.
- Illustrations: a hero image, then sticker sheets generated as edits with the hero as reference, split into cut-outs; textures from a cheap image model.
- Sound: ukulele and glockenspiel at 110 BPM, paper, pencil, stamp and swish effects placed on exact frames, music filtering down on "mistakes".
- Fonts: when the brand typeface is not licensed for this use, use open fonts (Caveat Brush, Barlow Condensed, Permanent Marker, all SIL OFL).

## Isolation and reference prompts (all styles)

> Isolated on a pure flat white background with a generous white margin on all sides, no floor shadow, no scenery, no frame, and absolutely NO text, letters, numbers, logos or brand marks anywhere. Any screens, laptops, documents and folders are blank or show only abstract shapes.

> Use the reference image(s) only for the exact art style, line weight, palette and character design; create a NEW illustration of the scene described, not a copy of the reference scene.

Add per image when people hold objects: "Every face is fully visible: no paper, hand or object in front of any face."
