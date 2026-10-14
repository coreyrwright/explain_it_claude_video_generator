# Eden AI notes

All paid calls go through `tools/eden.mjs` (spend guard, ledger, tags). This page is for choosing models and knowing the quirks.

## Basics

- Base URL: `https://api.edenai.run/v3` (standard) or `https://api.eu.edenai.run/v3` (EU-hosted models only). Set `eden.base` in `project.json`.
- Auth: `Authorization: Bearer <key>`. Tag every call (`X-EdenAI-Tags: brand=..,project=..,step=..`) so spend splits by brand and step in the Eden dashboard; `eden.mjs` does this from `project.json`.
- Costs come back per call (`cost` in JSON, or the `x-edenai-cost` header for audio). Eden adds a 5.5 percent platform fee at checkout.
- Public model lists (free): `GET /v3/models`, `/v3/images/models`, `/v3/audio/speech/models`, `/v3/audio/transcriptions/models`, `/v3/videos/models`, `GET /v3/audio/voices`.
- Docs for agents: `https://www.edenai.co/docs/llms.txt`.

## What we use, with typical cost

| Step | Endpoint | Model | Cost |
|---|---|---|---|
| Voice | `POST /v3/audio/speech` | `elevenlabs/eleven_v3` (voices: Will `bIHbv24MWmeRgasZH58o` warm male; Bella `hpp4J3VqNfWAUOO0d1Us` bright female) | about $0.00018 per character; 3.5 min about $0.45 |
| Voice, budget or EU | same | `vertex/chirp` (Chirp 3 HD voices, e.g. en-US-Chirp3-HD-Achird), `amazon/generative` | about $0.00003 per character |
| Word timings | `POST /v3/audio/transcriptions` (`response_format=verbose_json`, `timestamp_granularities[]=word`) | `deepgram/nova-3` and `deepgram/whisper-large` | under $0.01 per chapter |
| Illustrations | `POST /v3/images/generations`, `POST /v3/images/edits` (with `images: [{image_url: data URI}]`, several references allowed) | `google/gemini-3-pro-image` | about $0.14 each |
| Music, sound | `POST /v3/videos`, poll `GET /v3/videos/{id}`, download `/content` | `google/veo-3.1-lite-generate-preview`, 8 s | about $0.40 per clip (billed even if you only keep the audio) |
| Whole-film review | `POST /v3/upload` then `/v3/chat/completions` with the file id | `google/gemini-3.8-flash` | about $0.31 |
| Frame QA | `/v3/chat/completions` with images | `openai/gpt-5.5` (`reasoning_effort: low`) | $0.3 to $0.5 |
| Listening | `/v3/chat/completions` with `input_audio` (mp3 base64) | `google/gemini-3.1-pro-preview` | $0.03 to $0.08 |

## Quirks

- Image size requests are ignored; expect 2752x1536 (wide) or 2048x2048 (square).
- Gemini listening: send a small file (48 kbps mono MP3 for a 3.5-minute mix). Large files can arrive empty, and the model then asks you to upload. Raise `max_completion_tokens` if answers get cut off.
- Gemini judges show position bias in A/B listening; always run two orders.
- Veo clips drift slightly in tempo (110.7 instead of 112 BPM); measure and stretch.
- Deepgram Whisper can time out on long files; retry per chapter.
- A failed video job may still be billed; `eden.mjs` records what Eden reports.

## EU endpoint (data residency)

`https://api.eu.edenai.run/v3` routes only to EU-eligible providers. Available in October 2026: voices `vertex/chirp` (Chirp 3 HD, about 68 English male voices across en-US, en-GB, en-AU, en-IN) and Amazon Polly (`amazon/generative`, `long-form`, `neural`, `standard`); images `vertex/gemini-3-pro-image` and other Vertex Gemini image models; speech-to-text `mistral/voxtral-mini-latest` (check word timestamps before relying on it); LLMs including Gemini, Claude and Mistral on EU hosting; video only `amazon/nova-reel` (no audio), so no Veo music. Use it when the user needs EU data residency, and tell them what changes (no ElevenLabs voices, music made in code or licensed). Do not switch silently.
