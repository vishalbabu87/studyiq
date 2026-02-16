# GitHub -> Vercel (Free Tier)

## 1) Push to GitHub from terminal

```powershell
cd d:\studyspark\study
git init
git branch -M main
git add .
git commit -m "StudyIQ tracker + quiz updates"
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

## 2) Create Vercel project

1. Open https://vercel.com/new
2. Import your GitHub repository.
3. Framework Preset: keep Auto Detect.
4. Build Command: `npm run build`
5. Install Command: `npm install`
6. Output Directory: leave empty.

## 3) Environment variables (Project Settings -> Environment Variables)

- `GEMINI_API_KEY` (optional but recommended)
- `OPENAI_API_KEY` (optional fallback)
- `OCR_SPACE_KEY` (optional for OCR image extraction)

## 4) Deploy

Click Deploy. Vercel will auto-deploy on future `git push` to `main`.

## Notes

- This app stores user data in browser local storage + IndexedDB (single user, local-first).
- If AI API keys are missing or free limits are exhausted, quiz generation falls back to local logic.
