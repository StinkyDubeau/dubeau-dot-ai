import ollama from "ollama";
import express from "express";
import cors from "cors";
import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import bodyParser from "body-parser";
import download from "image-downloader";
import path from "node:path";

const model = "llava:13b";
const prompt = "Describe this Chevrolet Astro Van in 2 sentences or less. Ensure your response highlights the beauty and mystique of the Astro.";
const port = process.env.PORT;
const channelId = process.env.CHANNEL_ID;

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const astros = [];

app.get("/astros", (req, res) => {
	res.send(astros);
});

app.post("/ask", async (req, res, next) => {
    console.log("Asking...");
    console.log(req.body);

    res.send(await describe(req.body));
});

async function describe(astro) {
    console.log(`Image url: ${astro.image}`);
    console.log("Downloading image...");
    const image = await downloadImage(astro.image);

    console.log("Generating response...");
    const response = await ollama.chat({
        model: model,
        messages: [
            {
                role: "user",
                content: `${prompt}. The image was captured by ${astro.photographer}, and they titled it ${astro.title}. Make sure to reference the photographer's name, but don't use their literal name. Make a nickname for them.`,
                images: [path.resolve("./img/image.jpg")]
            }
        ]
    });

    console.log("Sending response...");
    return response;
}


app.get("/", (req, res) => {
	res.send("<p>Hello world</p>");
});

app.listen(port, () => {
    loadAstros();
    console.log(`Server running on port ${port}.`);
});

async function downloadImage(url) {
    return await download.image({
       url,
       dest: path.resolve("./img/image.jpg") 
    });
}

function loadAstros() {// Create a new client instance
	// When the client is ready, run this code (only once).
	// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
	// It makes some properties non-nullable.
	// client.once(Events.ClientReady, readyClient => {
	// 	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	// });

    client.on('ready', async() => {
        console.log(`Logged in as ${client.user.tag}`);
        
        // Replace 'channel_id' with the ID of the channel you want to iterate through
        const channel = client.channels.cache.get(channelId);
        
        if (!channel) {
          console.error('Channel not found.');
          return;
        }
        const response = await channel.fetch()

        channel.messages.fetch({ limit: 100 }).then(messages => {
            messages.forEach((message, index) => {
                let astro = {};

                message.attachments.forEach((attachment, index) => {
                    astro.key = index;
                    astro.title = message.content;
                    astro.image = attachment.url;
                    astro.timestamp = message.createdTimestamp;
                    astro.photographer = message.author.username;
                })

                // Only add to list if there is an image
                astro.image && astros.push(astro);
            });
            // messages.forEach((message, index) => {
            //     console.log(messageasync);
            // })
        })
      });

	// Log in to Discord with your client's token
	client.login(process.env.DISCORD_TOKEN);
}



console.log("App running.");
