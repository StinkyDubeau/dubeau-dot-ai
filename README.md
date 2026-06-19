# dubeau-dot-ai

This repo contains a simple server which is used by www.dubeau.org for some AI and scraping functions.

index.js currently contains a Discord scraper and an Ollama instance which, combined, serve "Astro Sightings" on dubeau.org.

0. Host on debian (tested with 11 stable)
1. Install node
2. Install ollama (apt install ollama)
3. Get a model (`ollama pull nous-hermes2:13b`)
4. Install dependencies (`npm i`)
5. Define environment variables:
```
PORT=XXXX, e.g. 3000
CORS_ORIGIN=http://localhost:4173
ADMIN_TOKEN=optional bearer token for POST endpoints
MODEL=name of model, e.g. llava:13b

Discord:
DISCORD_TOKEN=[Your token from the Bot page of https://discord.com/developers/applications/]
DISCORD_CHANNEL_ID=[Right click channel > Copy Channel ID]
ASTROS_LIMIT=100
```

6. `npm run dev`

## Endpoints

- `GET /health` — server status and Astro Sightings cache state.
- `GET /astros` — cached Discord image uploads, newest first.
- `POST /astros/refresh` — manually refresh the Discord cache.
- `POST /ask` — generate an Ollama description for one Astro object.
