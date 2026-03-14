# Deploy on Railway

Steps to run your Discord bot and web app on [Railway](https://railway.app) for free.

## 1. Push your code to GitHub

If you haven’t already:

```bash
git init
git add .
git commit -m "Initial commit"
# Create a repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Choose your Discord bot repository and deploy. Railway will detect Node and run `npm install` and `npm start`.

## 3. Set environment variables

In your Railway project: **Your Service** → **Variables** → **Add Variable**. Add:

| Variable        | Value                    | Required |
|----------------|--------------------------|----------|
| `DISCORD_TOKEN`| Your bot token from the [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Reset/Copy | **Yes** |
| `API_KEY`      | A secret string (e.g. a long random password)        | **Yes** (see below) |
| `GUILD_ID`     | Your Discord server ID (optional; makes slash commands show up in ~1 min instead of up to 1 hour) | No |

- **Why `API_KEY` is required on Railway:** The app is reachable on the internet. If `API_KEY` is not set, the web app and API only accept requests from localhost, so the hosted site would be unusable. Set `API_KEY` and then enter that same value in the “API key” field on the web app so your browser can call the API.

## 4. Get your app URL

1. In Railway, open your service → **Settings** → **Networking**.
2. Click **Generate Domain**. Railway will assign a URL like `your-app.up.railway.app`.
3. Open that URL in your browser. You should see the Discord Scheduler web app. Enter your `API_KEY` in the field at the top and use the app as usual.

## 5. (Optional) Persistent data

By default, Railway’s disk is **ephemeral**: schedules and saved messages in `data/` can be lost on redeploy or when the service restarts. To keep them:

1. In Railway: **Your Service** → **Volumes** → **Add Volume**.
2. Mount it at a path, e.g. `/data`.
3. We’d need to change the app to read/write `data/` from that path (e.g. via an env var `DATA_DIR=/data`). If you want this, say so and we can add it.

## Summary

- **Bot:** Runs 24/7 on Railway; uses `DISCORD_TOKEN` to connect to Discord.
- **Web app:** Served at your Railway URL; protect it with `API_KEY` and enter that key in the page.
- **Slash commands:** If you set `GUILD_ID`, they appear in your server quickly; otherwise they can take up to an hour to show everywhere.
