import { defineHandler } from 'nitro';

export default defineHandler(() => ({ connected: Boolean(process.env.OPENAI_API_KEY) }));
