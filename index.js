import ollama from "ollama";
import express from "express";
import 'dotenv/config';
import bodyParser from "body-parser";

const model = "nous-hermes2";
const port = process.env.PORT;

const app = express();

app.get("/", (req, res) => {
	res.send("<h1>Hello world.</h1>");
});

app.listen(port, () => {
    console.log(`Server running on port ${port}.`);
});

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
