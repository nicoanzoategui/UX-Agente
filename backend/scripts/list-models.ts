import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../src/config/env.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');

async function list() {
    try {
        console.log('Listing models with key...');
        const models = await genAI.listModels();
        for (const m of models.models) {
            console.log('-', m.name);
        }
    } catch (e: any) {
        console.error('Failed to list models:', e.message);
    }
}

list();
