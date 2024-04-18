import ollama from "ollama";

const model = "nous-hermes2"

// const response = await ollama.chat({
//     model: "nous-hermes2",
//     messages: [{ role: "user", content: "Why is the sky blue?" }],
// });

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
console.log(ask("What's the time in Jakarta?"));
