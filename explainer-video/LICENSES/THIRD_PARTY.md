# Third-party components

| Component | License | How it is used |
|---|---|---|
| Inter (font, Rasmus Andersson and The Inter Project Authors) | SIL Open Font License 1.1 | Bundled in `template/fonts/` (Regular, Medium, SemiBold, Bold). The license text is in `template/fonts/OFL.txt` and is copied into every scaffolded project. |
| puppeteer-core | Apache-2.0 | Not bundled. Installed at setup by `scripts/setup_runtime.sh` into the video runtime (`~/.video-runtime` or `$VIDEO_RUNTIME`). |
| numpy | BSD-3-Clause | Not bundled. Installed at setup into the runtime's Python venv. |
| scipy | BSD-3-Clause | Not bundled. Installed at setup into the runtime's Python venv. |
| Pillow | MIT-CMU (HPND) | Not bundled. Installed at setup into the runtime's Python venv. |

Also required on the machine but not part of this repository: Node.js, Python 3, ffmpeg and Google Chrome (each under its own license).

The example brand's logo and icons (`brands/example/`) and the sound effects (`template/assets/audio/sfx/`, synthesized by `template/tools/sfx_make.py`) are original to this project and contain no third-party material.
