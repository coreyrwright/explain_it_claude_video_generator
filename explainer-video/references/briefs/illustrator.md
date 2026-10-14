You are generating the character illustrations for a <length> <style> explainer video for <brand>. Work autonomously; report back when done.

PROJECT FOLDER (B): "<path>/video-build". Read B/PLAN.md (Look, and the table "Characters and illustrations": it is the contract, the animation loads exactly B/assets/illus/<id>.png for those ids), B/assets/illus/jobs.json, and the tools: tools/gen-illus.mjs (Gemini 3 Pro Image via Eden; a hero image sets the style, later images are edits with references), tools/cutout.py, tools/contact.py, tools/eden.mjs (spend guard; never print the API key). Python: project.json "python". Style prompts for this style: <paste the style block from references/styles.md with the brand palette filled in>.

BUDGET: at most $<2.50> (about $0.14 per image). Count your own calls.

STEPS
1. Write the style, isolation and reference prompts and one job per id into jobs.json. Keep recurring characters consistent: <list each character with fixed traits, e.g. "the protagonist: short curly hair, green sweater, round glasses">. No text, letters, numbers or logos in any image; blank screens and papers; every face fully visible.
2. Generate the hero (<hero id>) first, look at it (Read the PNG), regenerate once if the style is off.
3. Generate each character's first appearance in parallel with the hero as reference; then the variants with two references (hero for style, the character's first image for identity).
4. Inspect every image. Regenerate (at most 4 in total) only for real problems: text or logos, wrong identity, broken anatomy, a face covered by an object, off-palette props, non-white background.
5. Cut out with cutout.py --keep-holes into B/assets/illus/<id>.png (max width 1600) and check each on a light and a dark background. Raw files go to B/assets/raw/illus/.
6. Contact sheet B/review/illus_sheet.jpg on the background color.

Do not edit B/js, B/index.html or B/PLAN.md, and do not touch audio. No em dashes in anything you write.

FINAL REPORT (concise): files with pixel sizes, regenerations and why, placement notes for the animators (where faces are, which way characters face, where hands point, which side has room for a UI element), your spend.
