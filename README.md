# up-j-ex

Upwork Job Extractor for PlugWheel — an automation agency job filtering tool.

## What it does

- Upload Upwork HTML files (drag & drop supported)
- AI extracts only automation-related jobs using OpenAI GPT-4o-mini
- Stores jobs in MongoDB with smart duplicate prevention
- Exports filtered jobs to Excel with full metadata
- Auto-syncs to Google Sheets after each upload

## Features

- **Smart Filtering**: Only extracts jobs relevant to PlugWheel's services (workflow automation, n8n, Make.com, Zapier, scraping, browser automation, etc.)
- **Job Scoring**: Each job gets a fit score (1-10), urgency level, and service category
- **Drag & Drop Upload**: Simple file drop zone for HTML files
- **Excel Preview**: Preview data before downloading
- **Duplicate Prevention**: Same job link won't be inserted twice
- **Single Job Extraction**: When viewing a job detail modal, only that job is extracted
- **Google Sheets Sync**: One-click upload to Google Sheets with optional clear-before-write

## Tech Stack

- Next.js 16 + TypeScript + Tailwind CSS
- MongoDB + Mongoose
- OpenAI API
- Google Sheets API
- xlsx (Excel generation)

## Setup

```bash
npm install
```

Create `.env.local`:
```env
MONGODB_URI=your-mongodb-uri
OPENAI_API_KEY=your-openai-key
GOOGLE_SHEET_URL=https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

> **Note:** `GOOGLE_SERVICE_ACCOUNT_JSON` is the contents of your Google service account key file as a single-line JSON string. This is required for production deployments (the file is not committed to git).

```bash
npm run dev
```

Open http://localhost:3000

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `OPENAI_API_KEY` | OpenAI API key |
| `GOOGLE_SHEET_URL` | Full URL of the target Google Sheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Google service account key JSON (single-line string) |
