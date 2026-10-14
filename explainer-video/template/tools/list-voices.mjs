// Lists TTS voices per model (free endpoint) so auditions can pick ids. Usage: node list-voices.mjs [filter]
import fs from 'node:fs'; import path from 'node:path'; import { ROOT, apiKey } from './eden.mjs';
import { cfg } from './config.mjs';
const res = await fetch(`${process.env.EDEN_BASE || cfg.eden.base}/audio/voices`, { headers: { Authorization: `Bearer ${apiKey()}` } });
const d = await res.json();
fs.mkdirSync(path.join(ROOT, 'review'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'review/voices.json'), JSON.stringify(d, null, 2));
const items = Array.isArray(d) ? d : d.data || d.voices || Object.values(d).flat();
console.log('total', items.length, 'keys', Object.keys(items[0] || {}));
