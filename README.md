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

## Permanent user storage on Render

This project is now configured for persistent Render storage.

- The Blueprint uses a persistent disk mounted at `/var/data/hni`
- `APP_STORAGE_DIR` is set to `/var/data/hni`
- User accounts, login records, chat data, and uploaded media are stored there

That means your users can sign up once and keep logging in across devices, redeploys, and restarts as long as the same Render disk stays attached to the service.

The app stores:

- SQLite database under `APP_STORAGE_DIR/data`
- uploaded media under `APP_STORAGE_DIR/media`

## Deploy update

If you already deployed this app on Render:

1. Open your Render web service
2. Sync it with the latest `render.yaml`
3. Let Render upgrade the service plan and attach the disk
4. Redeploy once

On the first deploy with a disk attached, the server will copy any existing local `data/` and `media/` files into the persistent storage path if that new disk is still empty.

## Important note

Render persistent disks are not available on the free web-service plan, so this Blueprint uses a paid web-service plan for true persistence.
