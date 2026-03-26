# Harvest Nation International

This app includes:

- Node/Express backend
- SQLite auth and chat storage
- Frontend pages under `/bright/...`

## Local run

```powershell
npm install
npm start
```

Open:

- `http://127.0.0.1:3000/bright/mainpage/mainpage.html`

## Render deployment

This repo is prepared for a single Render web service.

### Option 1: Blueprint

Render can use the included `render.yaml`.

### Option 2: Manual web service

Use these settings:

- Environment: `Node`
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

After deploy, open the service root URL. It redirects to:

- `/bright/mainpage/mainpage.html`

## Important note about storage

By default, SQLite data and uploaded media are stored on the service filesystem.
On Render free instances this storage is ephemeral, so data can be lost on restart or redeploy.

If you want persistence, attach a persistent disk and set:

- `APP_STORAGE_DIR=/var/data/hni`

The app will then store:

- SQLite database under `APP_STORAGE_DIR/data`
- uploaded media under `APP_STORAGE_DIR/media`
