// Runs a Python tool with the project's configured interpreter (project.json "python", else the runtime venv).
// Usage: node tools/py.mjs <script.py> [args...]      e.g. node tools/py.mjs mix.py
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, pythonBin } from './config.mjs';

const [script, ...rest] = process.argv.slice(2);
if (!script) { console.error('usage: node tools/py.mjs <script.py> [args]'); process.exit(2); }
const file = path.isAbsolute(script) ? script : path.join(ROOT, 'tools', script);
const r = spawnSync(pythonBin(), ['-I', file, ...rest], { stdio: 'inherit', cwd: ROOT });
process.exit(r.status ?? 1);
