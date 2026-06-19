import "dotenv/config";

import bodyParser from "body-parser";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";
import download from "image-downloader";
import express from "express";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import ollama from "ollama";
import path from "node:path";

const model = process.env.MODEL || "llava:13b";
const prompt =
    "Describe this Chevrolet Astro Van in 2 sentences or less. Ensure your response highlights the beauty and mystique of the Astro.";
const port = Number(process.env.PORT || 3000);
const astrosLimit = Number(process.env.ASTROS_LIMIT || 100);
const astroSyncLimit = Number(process.env.ASTRO_SYNC_LIMIT ?? 1000);
const astroDataPath = path.resolve(
    process.env.ASTRO_DATA_PATH || "./data/astro-sightings.json",
);
const astroSecretsPath = path.resolve(
    process.env.ASTRO_SECRETS_PATH || "./data/astro-secrets.json",
);
const adminToken = process.env.ADMIN_TOKEN;
const corsOrigin = process.env.CORS_ORIGIN || "*";

const app = express();
let client = createDiscordClient();
let activeDiscordToken = null;
let discordConfig = {
    token: process.env.DISCORD_TOKEN || "",
    channelId: process.env.DISCORD_CHANNEL_ID || "",
};

let astros = [];
let astroMessages = [];
let sightings = [];
let lastRefresh = null;
let lastRefreshError = null;
let refreshInFlight = null;
let timelineSyncInFlight = null;
let lastTimelineSync = null;
let lastTimelineSyncError = null;
let writeStorageInFlight = Promise.resolve();

app.use(cors({ origin: corsOrigin }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.get("/", (req, res) => {
    res.send("<p>This is dubeau-dot-ai web server.</p>");
});

app.get("/health", (req, res) => {
    res.send({
        ok: true,
        astros: astros.length,
        astroMessages: astroMessages.length,
        sightings: sightings.length,
        discordConfigured: hasDiscordConfig(),
        lastRefresh,
        lastRefreshError,
        lastTimelineSync,
        lastTimelineSyncError,
        astroDataPath,
    });
});

app.get("/astros", (req, res) => {
    res.send(astros);
});

app.post("/astros/refresh", requireAdminToken, async (req, res, next) => {
    try {
        const result = await refreshAstros();

        res.send(result);
    } catch (error) {
        next(error);
    }
});

app.get("/admin/discord", requireConfiguredAdminToken, (req, res) => {
    res.send(getDiscordConfigStatus());
});

app.post("/admin/discord", requireConfiguredAdminToken, async (req, res, next) => {
    try {
        const token = String(req.body?.discordToken || "").trim();
        const channelId = String(req.body?.discordChannelId || "").trim();

        if (!token || !channelId) {
            res.status(400).send({
                ok: false,
                error: "discordToken and discordChannelId are required.",
            });
            return;
        }

        await saveDiscordConfig({ token, channelId });

        res.send(getDiscordConfigStatus());
    } catch (error) {
        next(error);
    }
});

app.get("/astro/messages", (req, res) => {
    const limit = clampNumber(req.query.limit, 1, 500, 100);
    const before = Number(req.query.before || Number.POSITIVE_INFINITY);
    const sort = req.query.sort === "desc" ? "desc" : "asc";
    const sortedMessages = [...astroMessages].sort((a, b) =>
        sort === "desc"
            ? b.createdTimestamp - a.createdTimestamp
            : a.createdTimestamp - b.createdTimestamp,
    );
    const filteredMessages = Number.isFinite(before)
        ? sortedMessages.filter((message) => message.createdTimestamp < before)
        : sortedMessages;
    const messages = filteredMessages.slice(0, limit);

    res.send({
        messages,
        nextBefore:
            messages.length > 0
                ? messages[messages.length - 1].createdTimestamp
                : null,
        total: astroMessages.length,
    });
});

app.post("/astro/sync", requireAdminToken, async (req, res, next) => {
    try {
        const maxMessages = normalizeSyncLimit(
            req.body?.maxMessages === undefined
                ? astroSyncLimit
                : req.body.maxMessages,
        );
        const result = await syncDiscordTimeline({ maxMessages });

        res.send(result);
    } catch (error) {
        next(error);
    }
});

app.get("/astro/sightings", (req, res) => {
    res.send({ sightings });
});

app.post("/astro/sightings", requireAdminToken, async (req, res, next) => {
    const sighting = {
        id: req.body?.id || `sighting-${Date.now()}`,
        title: req.body?.title || "",
        attachmentIds: req.body?.attachmentIds || [],
        messageIds: req.body?.messageIds || [],
        reactionRefs: req.body?.reactionRefs || [],
        notes: req.body?.notes || "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    };

    try {
        sightings = [sighting, ...sightings];
        await persistAstroData();

        res.status(201).send({ sighting });
    } catch (error) {
        next(error);
    }
});

app.patch("/astro/sightings/:id", requireAdminToken, async (req, res, next) => {
    const index = sightings.findIndex((sighting) => sighting.id === req.params.id);

    if (index === -1) {
        res.status(404).send({ ok: false, error: "Sighting not found" });
        return;
    }

    const nextSighting = {
        ...sightings[index],
        ...req.body,
        id: sightings[index].id,
        updatedAt: new Date().toISOString(),
    };

    sightings = [
        ...sightings.slice(0, index),
        nextSighting,
        ...sightings.slice(index + 1),
    ];

    try {
        await persistAstroData();

        res.send({ sighting: nextSighting });
    } catch (error) {
        next(error);
    }
});

app.post("/ask", requireAdminToken, async (req, res, next) => {
    try {
        res.send(await describe(req.body));
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).send({
        ok: false,
        error: error.message || "Internal server error",
    });
});

await loadPersistedDiscordConfig();
await loadPersistedAstroData();

app.listen(port, async () => {
    console.log(`Server running on port ${port}.`);
    console.log(`Astro Sightings local storage: ${astroDataPath}`);
    console.log(`Astro Sightings local secrets: ${astroSecretsPath}`);

    if (!hasDiscordConfig()) {
        console.log(
            "Discord scraping disabled. Set DISCORD_TOKEN/DISCORD_CHANNEL_ID or use POST /admin/discord.",
        );
        return;
    }

    try {
        await loginDiscord();
        await refreshAstros();
        await syncDiscordTimeline({ maxMessages: astrosLimit });
    } catch (error) {
        lastRefreshError = error.message;
        console.error("Initial Astro Sightings refresh failed:", error);
    }
});

function clampNumber(value, min, max, fallback) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return fallback;
    }

    return Math.min(max, Math.max(min, number));
}

function normalizeSyncLimit(value) {
    const number = Number(value);

    if (!Number.isFinite(number) || number < 0) {
        return astroSyncLimit;
    }

    return Math.floor(number);
}

function createDiscordClient() {
    return new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMessageReactions,
        ],
    });
}

function getDiscordToken() {
    return discordConfig.token;
}

function getDiscordChannelId() {
    return discordConfig.channelId;
}

function hasDiscordConfig() {
    return Boolean(getDiscordToken() && getDiscordChannelId());
}

function maskSecret(value) {
    if (!value) {
        return null;
    }

    if (value.length <= 8) {
        return "••••";
    }

    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function getDiscordConfigStatus() {
    return {
        ok: true,
        configured: hasDiscordConfig(),
        discordChannelId: getDiscordChannelId() || null,
        discordTokenMasked: maskSecret(getDiscordToken()),
        adminTokenConfigured: Boolean(adminToken),
        astroSecretsPath,
    };
}

function requireAdminToken(req, res, next) {
    if (!adminToken) {
        return next();
    }

    const token = req.get("authorization")?.replace(/^Bearer\s+/i, "");

    if (token === adminToken) {
        return next();
    }

    res.status(401).send({ ok: false, error: "Unauthorized" });
}

function requireConfiguredAdminToken(req, res, next) {
    if (!adminToken) {
        res.status(403).send({
            ok: false,
            error: "Set ADMIN_TOKEN on the server before saving Discord credentials.",
        });
        return;
    }

    requireAdminToken(req, res, next);
}

async function loginDiscord() {
    const token = getDiscordToken();

    if (!token) {
        throw new Error("Discord token is not configured.");
    }

    if (client.isReady() && activeDiscordToken === token) {
        return;
    }

    if (client.isReady()) {
        client.destroy();
        client = createDiscordClient();
        activeDiscordToken = null;
    }

    await client.login(token);
    activeDiscordToken = token;
    await new Promise((resolve) => {
        if (client.isReady()) {
            resolve();
            return;
        }

        client.once("ready", resolve);
    });

    console.log(`Logged in as ${client.user.tag}`);
}

async function refreshAstros() {
    if (refreshInFlight) {
        return refreshInFlight;
    }

    refreshInFlight = loadAstros()
        .then((nextAstros) => {
            astros = nextAstros;
            lastRefresh = new Date().toISOString();
            lastRefreshError = null;

            return persistAstroData().then(() => ({
                ok: true,
                astros: astros.length,
                lastRefresh,
            }));
        })
        .catch((error) => {
            lastRefreshError = error.message;
            throw error;
        })
        .finally(() => {
            refreshInFlight = null;
        });

    return refreshInFlight;
}

async function loadAstros() {
    const messages = await fetchDiscordMessages({ maxMessages: astrosLimit });
    const nextAstros = [];

    messages.forEach((message) => {
        message.attachments.forEach((attachment, index) => {
            if (!attachment.contentType?.startsWith("image/")) {
                return;
            }

            nextAstros.push({
                key: `${message.id}-${attachment.id || index}`,
                title: message.content,
                image: attachment.url,
                timestamp: message.createdTimestamp,
                photographer: message.author.username,
            });
        });
    });

    nextAstros.sort((a, b) => b.timestamp - a.timestamp);

    return nextAstros;
}

async function syncDiscordTimeline({ maxMessages = astroSyncLimit } = {}) {
    if (timelineSyncInFlight) {
        return timelineSyncInFlight;
    }

    timelineSyncInFlight = fetchDiscordMessages({ maxMessages })
        .then((messages) => {
            astroMessages = messages
                .map(normalizeDiscordMessage)
                .sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            astros = deriveAstrosFromMessages(astroMessages);
            lastTimelineSync = new Date().toISOString();
            lastTimelineSyncError = null;
            lastRefresh = lastTimelineSync;
            lastRefreshError = null;

            return persistAstroData().then(() => ({
                ok: true,
                messages: astroMessages.length,
                astros: astros.length,
                lastTimelineSync,
                capped: maxMessages > 0,
            }));
        })
        .catch((error) => {
            lastTimelineSyncError = error.message;
            throw error;
        })
        .finally(() => {
            timelineSyncInFlight = null;
        });

    return timelineSyncInFlight;
}

async function fetchDiscordMessages({ maxMessages = astrosLimit } = {}) {
    if (!hasDiscordConfig()) {
        throw new Error("Discord token and channel id are not configured.");
    }

    await loginDiscord();

    const channel = await client.channels.fetch(getDiscordChannelId());

    if (!channel?.messages) {
        throw new Error("Discord channel not found or is not message-readable.");
    }

    const messages = [];
    let before;
    const unlimited = maxMessages === 0;

    while (unlimited || messages.length < maxMessages) {
        const remaining = unlimited ? 100 : maxMessages - messages.length;
        const batch = await channel.messages.fetch({
            limit: Math.min(100, remaining),
            ...(before ? { before } : {}),
        });

        if (batch.size === 0) {
            break;
        }

        const batchMessages = [...batch.values()];

        messages.push(...batchMessages);

        const oldest = batchMessages.reduce((oldestMessage, message) =>
            message.createdTimestamp < oldestMessage.createdTimestamp
                ? message
                : oldestMessage,
        );

        before = oldest.id;

        if (batch.size < 100) {
            break;
        }
    }

    return messages;
}

function normalizeDiscordMessage(message) {
    const attachments = [...message.attachments.values()].map(
        (attachment, index) => ({
            id: attachment.id || `${message.id}-${index}`,
            messageId: message.id,
            name: attachment.name,
            url: attachment.url,
            proxyUrl: attachment.proxyURL,
            contentType: attachment.contentType,
            size: attachment.size,
            width: attachment.width,
            height: attachment.height,
            isImage: Boolean(attachment.contentType?.startsWith("image/")),
        }),
    );
    const reactions = [...message.reactions.cache.values()].map((reaction) => ({
        emoji: reaction.emoji.name,
        emojiId: reaction.emoji.id,
        emojiUrl: reaction.emoji.imageURL?.() || null,
        count: reaction.count,
    }));

    return {
        id: message.id,
        channelId: message.channelId,
        guildId: message.guildId,
        url: message.url,
        content: message.content,
        createdAt: message.createdAt?.toISOString(),
        createdTimestamp: message.createdTimestamp,
        editedAt: message.editedAt?.toISOString() || null,
        author: {
            id: message.author?.id,
            username: message.author?.username,
            displayName: message.member?.displayName || message.author?.username,
            avatarUrl: message.author?.displayAvatarURL?.() || null,
            bot: Boolean(message.author?.bot),
        },
        reference: message.reference
            ? {
                  channelId: message.reference.channelId,
                  guildId: message.reference.guildId,
                  messageId: message.reference.messageId,
              }
            : null,
        attachments,
        reactions,
    };
}

function deriveAstrosFromMessages(messages) {
    const nextAstros = [];

    messages.forEach((message) => {
        message.attachments.forEach((attachment, index) => {
            if (!attachment.isImage) {
                return;
            }

            nextAstros.push({
                key: `${message.id}-${attachment.id || index}`,
                title: message.content,
                image: attachment.url,
                timestamp: message.createdTimestamp,
                photographer: message.author.username,
                messageId: message.id,
                attachmentId: attachment.id,
            });
        });
    });

    nextAstros.sort((a, b) => b.timestamp - a.timestamp);

    return nextAstros;
}

async function loadPersistedDiscordConfig() {
    try {
        const stored = JSON.parse(await readFile(astroSecretsPath, "utf8"));

        discordConfig = {
            token: process.env.DISCORD_TOKEN || stored.discordToken || "",
            channelId:
                process.env.DISCORD_CHANNEL_ID ||
                stored.discordChannelId ||
                "",
        };

        console.log(
            `Loaded Discord config: channel ${getDiscordChannelId() || "(none)"}, token ${getDiscordToken() ? "configured" : "missing"}.`,
        );
    } catch (error) {
        if (error.code === "ENOENT") {
            return;
        }

        throw error;
    }
}

async function saveDiscordConfig({ token, channelId }) {
    const tokenChanged = token !== getDiscordToken();

    discordConfig = { token, channelId };

    await mkdir(path.dirname(astroSecretsPath), { recursive: true });

    const tmpPath = `${astroSecretsPath}.tmp`;
    await writeFile(
        tmpPath,
        JSON.stringify(
            {
                version: 1,
                updatedAt: new Date().toISOString(),
                discordToken: token,
                discordChannelId: channelId,
            },
            null,
            2,
        ),
        { mode: 0o600 },
    );
    await chmod(tmpPath, 0o600);
    await rename(tmpPath, astroSecretsPath);
    await chmod(astroSecretsPath, 0o600);

    if (tokenChanged && client.isReady()) {
        client.destroy();
        client = createDiscordClient();
        activeDiscordToken = null;
    }
}

async function loadPersistedAstroData() {
    try {
        const stored = JSON.parse(await readFile(astroDataPath, "utf8"));

        astroMessages = Array.isArray(stored.astroMessages)
            ? stored.astroMessages
            : [];
        sightings = Array.isArray(stored.sightings) ? stored.sightings : [];
        astros = Array.isArray(stored.astros)
            ? stored.astros
            : deriveAstrosFromMessages(astroMessages);
        lastRefresh = stored.lastRefresh || null;
        lastTimelineSync = stored.lastTimelineSync || null;

        console.log(
            `Loaded Astro Sightings storage: ${astroMessages.length} messages, ${astros.length} astros, ${sightings.length} sightings.`,
        );
    } catch (error) {
        if (error.code === "ENOENT") {
            return;
        }

        throw error;
    }
}

async function persistAstroData() {
    const payload = {
        version: 1,
        updatedAt: new Date().toISOString(),
        lastRefresh,
        lastTimelineSync,
        astros,
        astroMessages,
        sightings,
    };

    writeStorageInFlight = writeStorageInFlight
        .catch(() => {})
        .then(async () => {
            await mkdir(path.dirname(astroDataPath), { recursive: true });

            const tmpPath = `${astroDataPath}.tmp`;
            await writeFile(tmpPath, JSON.stringify(payload, null, 2));
            await rename(tmpPath, astroDataPath);
        });

    return writeStorageInFlight;
}

async function describe(astro) {
    console.log(`Image url: ${astro.image}`);
    console.log("Downloading image...");
    await downloadImage(astro.image);

    console.log("Generating response...");
    return await ollama.chat({
        model,
        messages: [
            {
                role: "user",
                content: `${prompt}. The image was captured by ${astro.photographer}, and they titled it ${astro.title}. Make sure to reference the photographer's name, but don't use their literal name. Make a nickname for them.`,
                images: [path.resolve("./img/image.jpg")],
            },
        ],
    });
}

async function downloadImage(url) {
    return await download.image({
        url,
        dest: path.resolve("./img/image.jpg"),
    });
}

console.log("App running.");
