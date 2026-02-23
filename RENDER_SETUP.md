## Render Setup (Mobile + OCR)

This project is configured so OCR and AI run on backend.
You do **not** need Tesseract on mobile.

### 1) Deploy backend on Render

1. Push this `study` folder to GitHub.
2. In Render: **New +** -> **Blueprint** (or Web Service from repo).
3. Select repo/folder containing this `Dockerfile` and `render.yaml`.
4. Deploy.

### 2) Add required environment variables in Render

Set in Render -> Service -> Environment:

- `OCR_SPACE_KEY` (optional but recommended)
- `GEMINI_API_KEY` (if using Gemini)
- `XAI_API_KEY` (if using Grok)
- `GROQ_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `SARVAM_API_KEY`
- `HUGGINGFACE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_KEY`

Tesseract vars are already defaulted by Docker:

- `TESSERACT_PATH=/usr/bin/tesseract`
- `TESSERACT_LANG=eng`

### 3) Connect your mobile app to this backend

In app local storage, set API base:

- key: `studyiq-api-base`
- value: your Render URL (example: `https://studyiq-backend.onrender.com`)

The 5003 UI/Android build will then call this hosted backend for extraction + quiz generation.

### 4) Resulting flow

1. Mobile uploads file.
2. Backend parses text.
3. OCR.Space runs first.
4. If OCR is weak, backend uses local Tesseract fallback.
5. AI filters/structures by prompt.
6. Clean term/meaning/example goes to library and quiz engine.
