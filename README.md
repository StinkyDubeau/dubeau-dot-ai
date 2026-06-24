# dubeau-dot-ai

Minimal Astro Sightings backend.

## Run

```bash
npm install
npm start
```

For live reload while editing the UI:

```bash
npm run dev
```

That runs the backend on `3000` and Vite on `5173`.

If you want Discord ingest, add these to `.env` or the environment:

```bash
DISCORD_TOKEN=...
DISCORD_CHANNEL_ID=...
ADMIN_TOKEN=...
```

That is enough for the app to run.

## Use

- Open `/` for the built-in control page.
- Use `/admin/discord` to save Discord credentials if you did not set them in the environment.
- Use `/astro/sync` to pull Discord history.
- Use `/astro/messages` and `/astro/sightings` for data.

## Files that persist

- `ASTRO_DATA_PATH` defaults to `./data/astro-sightings.json`
- `ASTRO_SECRETS_PATH` defaults to `./data/astro-secrets.json`

## Debian service

The fastest live setup is to run the built-in UI and API from this repo on the Debian box.

```bash
sudo loginctl enable-linger "$USER"
mkdir -p ~/.config/systemd/user
cp deploy/systemd/astro-sightings.service ~/.config/systemd/user/astro-sightings.service
systemctl --user daemon-reload
systemctl --user enable --now astro-sightings.service
systemctl --user status astro-sightings.service
```

That serves the control room on `http://<debian-ip>:3000/`.

## Optional template

Copy [.env.example](/home/jaked/checkout/dubeau-dot-ai/.env.example) if you want a starter file.
