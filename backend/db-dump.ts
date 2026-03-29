import { queryAll } from './src/db/database.js';

async function dump() {
    try {
        const stories = await queryAll('SELECT * FROM user_stories');
        const designs = await queryAll('SELECT * FROM design_outputs');
        console.log('--- STORIES ---');
        console.log(JSON.stringify(stories, null, 2));
        console.log('--- DESIGNS ---');
        console.log(JSON.stringify(designs, null, 2));
    } catch (e) {
        console.error(e);
    }
}

dump();
