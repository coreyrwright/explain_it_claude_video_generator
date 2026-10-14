# Brands

A brand profile is a folder `brands/<id>/` with `brand.json` (palette roles, font, logo files, style defaults, icon source, rules), the logo files and, optionally, an `icons/` folder. `scripts/new_project.mjs --brand <id>` turns it into the project's `js/theme.js` and copies the logos and icons. `brands/_template/brand.json` documents every field; `brands/example/` is a complete working example.

## Palette roles

Scenes use roles, not brand names, so the same scene code works for any brand: `ink` (text and outlines), `primary`, `accent`, `highlight` (small accents only), `bg` (background), `surface` (cards), `line` (borders), `accentTint`, `bgTint`, `muted` (secondary text, disabled states). Older aliases (`dark`, `purple`, `vibrant`, `lime`, `light`, `lilac`, `mist`, `grayDark`) still work so earlier scene code runs unchanged.

## Icons

A brand can ship its own icon SVGs in `brands/<id>/icons/` (a color version and a white version per icon); the scaffold copies them into the project. If your organization has an official icon library, export it there and add its usage rules to `rules`. Without icons, use text chips and drawn shapes. Never mix in icons from another brand.

## Adding a brand

1. Copy `brands/_template/` to `brands/<id>/`.
2. Fill the palette roles from the brand guide (check contrast: `ink` on `bg` and white on `primary` must be readable on a projector), the font (a licensed or open font; put font files in the folder if they are not Inter), the logo files (color and white versions, SVG preferred), style defaults, and `rules` (short, testable statements: forbidden colors, icon rules, language, things never to show, how to label AI-generated media).
3. If the brand has its own design guidelines or skills, mention them in its `rules` so future projects load them.
4. Scaffold a dry-run project with the new brand and render the storyboard of the demo scene to check the look before a real project.

## Brand rules worth checking in any brand guide

- Forbidden colors (some brands never use red; show "bad" states with gray, dashed lines or sad faces instead).
- Logo usage: official files only, never redrawn, clear space, white version on dark backgrounds.
- Icon rules: one icon set, allowed colors, always next to a text label.
- Imagery: whether AI-generated images are allowed at all, and how AI media must be labelled.
- Language and spelling variant, sentence case or title case.
- Typeface licensing: if the brand font is not licensed for video, pick an open font with a similar feel.
