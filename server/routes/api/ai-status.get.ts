import { defineHandler } from 'nitro';

export default defineHandler(() => ({ connected: Boolean(process.env.OPENROUTER_API_KEY) }));
