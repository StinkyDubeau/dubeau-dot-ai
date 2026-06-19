# dubeau-dot-ai

This repo contains a simple server which is used by www.dubeau.org for some AI and scraping functions.

index.js currently contains a Discord scraper and an Ollama instance which, combined, serve "Astro Sightings" on dubeau.org.

## Astro Sightings direction

Astro Sightings should ingest the full Discord channel history, not only recent image uploads. The frontend should show Discord chat as a timeline and let users curate "sightings" by linking photos, caption messages, replies, and reactions together.

Raw Discord timeline records and curated sighting records should remain separate:

- raw timeline: Discord message ids, authors, content, timestamps, attachments, replies/references, and reactions.
- curated sightings: user-selected groupings of timeline evidence, including one or more images, caption/supporting messages, bundled reactions, and optional notes/generated descriptions.

The intended next API shape is:

- `GET /astro/messages` — paginated normalized Discord timeline.
- `POST /astro/sync` — authorized Discord history sync.
- `GET /astro/sightings` — curated sightings.
- `POST /astro/sightings` — create curated sighting.
- `PATCH /astro/sightings/:id` — revise curation links/notes.

The existing `/astros` endpoint remains the compatibility image feed until the timeline API is implemented.

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
ASTRO_SYNC_LIMIT=1000 (set to 0 to sync the entire channel)
ASTRO_DATA_PATH=./data/astro-sightings.json
ASTRO_SECRETS_PATH=./data/astro-secrets.json
```

Discord bot requirements:

- Bot invited to the target server.
- `View Channel` and `Read Message History` permissions on the target channel.
- Privileged Message Content Intent enabled.
- Reaction intent/support when syncing reactions.

6. `npm run dev`

## Endpoints

- `GET /health` — server status and Astro Sightings cache state.
- `GET /admin/discord` — admin-token-protected masked Discord setup status.
- `POST /admin/discord` — admin-token-protected local Discord token/channel setup.
- `GET /astros` — cached Discord image uploads, newest first.
- `POST /astros/refresh` — manually refresh the Discord cache.
- `GET /astro/messages` — persisted normalized Discord timeline.
- `POST /astro/sync` — sync Discord history into local durable storage.
- `GET /astro/sightings` — curated sightings.
- `POST /astro/sightings` — create a curated sighting.
- `PATCH /astro/sightings/:id` — update a curated sighting.
- `POST /ask` — generate an Ollama description for one Astro object.
