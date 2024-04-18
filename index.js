import ollama from "ollama";
import express from "express";
import cors from "cors";
import 'dotenv/config';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import bodyParser from "body-parser";

const model = "nous-hermes2";
const port = process.env.PORT;
const channelId = process.env.CHANNEL_ID;

const app = express();
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent] });

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const astros = [
    // {
    //     image: "https://cdn.discordapp.com/attachments/937152144170164286/1222245255961645236/IMG_4819.jpg?ex=66313319&is=661ebe19&hm=a09bfe70fefa7bcdcc88f9e6a3e8569cab55cb188b76d605fc382379eddd9a71&",
    //     description:
    //         "This is a text description that will be from 100 to 200 words of the astro.",
    //     title: "Astro in the woods",
    // },
    // {
    //     image: "https://media.discordapp.net/attachments/937152144170164286/1221462776636248118/IMG_4796.jpg?ex=662e5a5b&is=661be55b&hm=89b0c6bf836d4ad79550dd519d21ca6913213b6cf6a3d247a843c72c191d286c&=&format=webp&width=265&height=354",
    //     description:
    //         "This is a text description that will be from 100 to 200 words of the astro.",
    //     title: "Astro approach",
    // },
    // {
    //     image: "https://media.discordapp.net/attachments/937152144170164286/1218726850948370452/IMG_6605.png?ex=662da0d4&is=661b2bd4&hm=25fca5c4f629fdc74b93f36dbbc326a25d6b8be3d2d36e7d55023635438117cd&=&format=webp&quality=lossless&width=162&height=350",
    //     description:
    //         "This is a text description that will be from 100 to 200 words of the astro.",
    //     title: "Google maps astro",
    // },
];

app.get("/astros", (req, res) => {
	res.send(astros);
});

app.get("/", (req, res) => {
	res.send("<p>Hello world</p>");
});

app.listen(port, () => {
    main();
    console.log(`Server running on port ${port}.`);
});

function main() {// Create a new client instance
	// When the client is ready, run this code (only once).
	// The distinction between `client: Client<boolean>` and `readyClient: Client<true>` is important for TypeScript developers.
	// It makes some properties non-nullable.
	client.once(Events.ClientReady, readyClient => {
		console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	});

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
                    console.log(message.content); // MESSAGE CONTENT
                    message.content && (astro.title = message.content);

                    console.log(attachment.attachment); //URL OF IMAGE
                    astro.image = attachment.url;
                    astro.timestamp = message.createdTimestamp;
                    astro.photographer = message.author.username;
                    astro.description = "This article has not been written yet.";


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

async function ask(prompt) {
    const response = await ollama.chat({
        model: model,
        messages: [
            {
                role: "user",
                content: prompt,
            }
        ]
    });
    return 
}

console.log("App running.");
// console.log(ask("What's the time in Jakarta?"));
