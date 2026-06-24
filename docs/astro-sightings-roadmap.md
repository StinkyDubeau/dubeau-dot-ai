# Astro Sightings backend roadmap

## Product requirement

Astro Sightings must ingest the entire configured Discord channel history and expose it as a timeline. Users of the frontend will then decide which messages, image attachments, replies, and reactions belong together as a curated "sighting".

The backend should not flatten Discord into a simple image list. It should keep raw Discord source data and curated sighting groupings as separate records.

## Current state

- Express server in `index.js`.
- Discord bot via `discord.js`.
- Existing `/astros` compatibility endpoint returns image attachments from the latest `ASTROS_LIMIT` messages.
- Existing `/ask` endpoint generates image descriptions through Ollama.
- No durable database yet.
- No full-history pagination yet.
- No curation model yet.

## Next implementation steps

1. Add durable storage.
   - Current local default: JSON file at `ASTRO_DATA_PATH` (`./data/astro-sightings.json`).
   - Near-term upgrade: SQLite via `ASTRO_DB_PATH`.
   - Later production option: Postgres via `DATABASE_URL`.

2. Normalize Discord timeline data.
   - messages
   - authors
   - attachments
   - reactions
   - reply/reference metadata

3. Replace latest-only fetch with paginated history sync.
   - Use `channel.messages.fetch({ limit: 100, before })`.
   - Continue until no older messages remain or an explicit sync boundary is reached.
   - Upsert records by Discord ids.

4. Add timeline API.
   - `GET /astro/messages`
   - `POST /astro/sync`

5. Add curation API.
   - `GET /astro/sightings`
   - `POST /astro/sightings`
   - `PATCH /astro/sightings/:id`

6. Preserve compatibility.
   - Keep `GET /astros` returning the simple image feed until the main site has migrated.

## Authorization required before live sync

- `DISCORD_TOKEN`
- `DISCORD_CHANNEL_ID`
- or save those through `POST /admin/discord` into local `ASTRO_SECRETS_PATH`
- Bot invited to the target server/channel
- `View Channel`
- `Read Message History`
- Message Content Intent
- Reaction intent/support if reaction details are required
