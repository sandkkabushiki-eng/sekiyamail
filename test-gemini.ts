import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.GEMINI_API_KEY,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
});

async function main() {
    try {
        const response = await client.chat.completions.create({
            model: "gemini-2.0-flash",
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log(response.choices[0].message.content);
    } catch (error) {
        console.error(error);
    }
}

main();
