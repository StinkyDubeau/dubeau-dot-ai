import "dotenv/config";

import bodyParser from "body-parser";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";
import download from "image-downloader";
import express from "express";
import ollama from "ollama";
import path from "node:path";

const model = process.env.MODEL || "llava:13b";
const prompt =
    "Describe this Chevrolet Astro Van in 2 sentences or less. Ensure your response highlights the beauty and mystique of the Astro.";
const port = Number(process.env.PORT || 3000);
const discordChannelId = process.env.DISCORD_CHANNEL_ID;
const discordToken = process.env.DISCORD_TOKEN;
const astrosLimit = Number(process.env.ASTROS_LIMIT || 100);
const adminToken = process.env.ADMIN_TOKEN;
const corsOrigin = process.env.CORS_ORIGIN || "*";

const app = express();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

let astros = [];
let lastRefresh = null;
let lastRefreshError = null;
let refreshInFlight = null;

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
        discordConfigured: Boolean(discordToken && discordChannelId),
        lastRefresh,
        lastRefreshError,
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

app.listen(port, async () => {
    console.log(`Server running on port ${port}.`);

    if (!discordToken || !discordChannelId) {
        console.log(
            "Discord scraping disabled. Set DISCORD_TOKEN and DISCORD_CHANNEL_ID to load Astro Sightings.",
        );
        return;
    }

    try {
        await loginDiscord();
        await refreshAstros();
    } catch (error) {
        lastRefreshError = error.message;
        console.error("Initial Astro Sightings refresh failed:", error);
    }
});

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

async function loginDiscord() {
    if (client.isReady()) {
        return;
    }

    await client.login(discordToken);
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

            return {
                ok: true,
                astros: astros.length,
                lastRefresh,
            };
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
    await loginDiscord();

    const channel = await client.channels.fetch(discordChannelId);

    if (!channel?.messages) {
        throw new Error("Discord channel not found or is not message-readable.");
    }

    const messages = await channel.messages.fetch({ limit: astrosLimit });
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
