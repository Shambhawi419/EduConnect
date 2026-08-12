import OpenAI from 'openai';

// Unchanged from the Express version — the openai SDK works the same in a Next
// route handler as long as the route runs on the Node runtime (not Edge).
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default openai;
