import { queryAll } from '../src/db/database.js';

async function dump() {
    try {
        const cards = await queryAll('SELECT * FROM kickoff_cards');
        const wireframes = await queryAll('SELECT * FROM kickoff_wireframes');
        console.log('--- KICKOFF_CARDS ---');
        console.log(JSON.stringify(cards, null, 2));
        console.log('--- KICKOFF_WIREFRAMES ---');
        console.log(JSON.stringify(wireframes, null, 2));
    } catch (e) {
        console.error(e);
    }
}

dump();
