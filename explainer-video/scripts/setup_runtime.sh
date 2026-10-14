#!/usr/bin/env bash
# One-time (and idempotent) runtime setup for the explainer-video skill.
# Creates VIDEO_RUNTIME (default ~/.video-runtime) with
#   - package.json + puppeteer-core (npm install)
#   - venv/ with numpy, scipy and pillow
# and checks ffmpeg, ffprobe, node and Google Chrome. Libraries live outside the project folder so a
# project inside a synced folder (Box, OneDrive) never syncs thousands of library files.
# Usage: bash setup_runtime.sh        (re-run any time; it only fixes what is missing)
set -u
RT="${VIDEO_RUNTIME:-$HOME/.video-runtime}"
missing=()
say() { printf '%s\n' "$*"; }

say "Runtime folder: $RT"
mkdir -p "$RT"

# ---- node and puppeteer-core ---------------------------------------------------------------------
if ! command -v node >/dev/null 2>&1; then missing+=("node (install Node.js 20 or newer: https://nodejs.org or brew install node)"); fi
if [ ! -f "$RT/package.json" ]; then
  cat > "$RT/package.json" <<'JSON'
{
  "name": "video-runtime",
  "version": "1.0.0",
  "private": true,
  "description": "Shared runtime for explainer-video projects (puppeteer-core)",
  "dependencies": { "puppeteer-core": "^25.12.0" }
}
JSON
fi
if [ -d "$RT/node_modules/puppeteer-core" ]; then
  say "puppeteer-core: already installed"
elif command -v npm >/dev/null 2>&1; then
  say "puppeteer-core: npm install puppeteer-core@^25 (this downloads about 10 MB)"
  (cd "$RT" && npm install --no-audit --no-fund --silent puppeteer-core@^25) || missing+=("puppeteer-core (npm install failed; check the network, then re-run this script)")
else
  missing+=("npm (comes with Node.js)")
fi
[ -d "$RT/node_modules/puppeteer-core" ] || missing+=("puppeteer-core in $RT/node_modules")

# ---- python venv ---------------------------------------------------------------------------------
PY="$(command -v python3 || true)"
if [ -z "$PY" ]; then
  missing+=("python3 (3.9 or newer)")
else
  if [ ! -x "$RT/venv/bin/python" ]; then
    say "python: creating venv with $($PY --version 2>&1)"
    "$PY" -m venv "$RT/venv" || missing+=("python venv (python3 -m venv failed)")
  fi
  if [ -x "$RT/venv/bin/python" ]; then
    if "$RT/venv/bin/python" -c "import numpy, scipy, PIL" >/dev/null 2>&1; then
      say "python: numpy, scipy, pillow already installed"
    else
      say "python: pip install numpy scipy pillow"
      if ! "$RT/venv/bin/python" -m pip install --quiet --disable-pip-version-check numpy scipy pillow; then
        missing+=("python packages numpy scipy pillow (pip install failed, probably offline; connect to the network and re-run)")
      fi
    fi
    "$RT/venv/bin/python" -c "import numpy, scipy, PIL" >/dev/null 2>&1 || missing+=("python packages numpy scipy pillow are not importable in $RT/venv")
  fi
fi

# ---- system tools --------------------------------------------------------------------------------
command -v ffmpeg  >/dev/null 2>&1 || missing+=("ffmpeg (brew install ffmpeg)")
command -v ffprobe >/dev/null 2>&1 || missing+=("ffprobe (comes with ffmpeg)")
CHROME=""
for c in "${CHROME_PATH:-}" "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" /usr/bin/google-chrome /usr/bin/chromium; do
  [ -n "$c" ] && [ -x "$c" ] && CHROME="$c" && break
done
[ -n "$CHROME" ] || missing+=("Google Chrome (https://www.google.com/chrome/, or set CHROME_PATH)")

say ""
say "Summary"
say "  runtime:   $RT"
[ -d "$RT/node_modules/puppeteer-core" ] && say "  puppeteer: $(node -e "console.log(require('$RT/node_modules/puppeteer-core/package.json').version)" 2>/dev/null || echo installed)"
[ -x "$RT/venv/bin/python" ] && say "  python:    $RT/venv/bin/python ($("$RT/venv/bin/python" --version 2>&1))"
command -v ffmpeg >/dev/null 2>&1 && say "  ffmpeg:    $(ffmpeg -version 2>/dev/null | head -1 | cut -d' ' -f1-3)"
[ -n "$CHROME" ] && say "  chrome:    $CHROME"
if [ "${#missing[@]}" -eq 0 ]; then
  say ""; say "Everything is in place."
else
  say ""; say "MISSING:"; for m in "${missing[@]}"; do say "  - $m"; done
  exit 1
fi
