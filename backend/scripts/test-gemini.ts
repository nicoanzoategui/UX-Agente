import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../src/config/env.js';

const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || '');

async function test() {
    try {
        const modelId = config.GEMINI_MODEL;
        console.log(`Testing with ${modelId}...`);
        const model = genAI.getGenerativeModel({ model: modelId });
        const result = await model.generateContent('Hi');
        console.log('Success:', result.response.text());
    } catch (e: any) {
        console.error('Failed:', e?.message);
    }
}

test();
