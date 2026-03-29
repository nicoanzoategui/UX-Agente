
import { fetchPendingStories } from './src/services/jira.service.js';
import { config } from './src/config/env.js';

async function test() {
    console.log(`Config: project=${config.JIRA_PROJECT_KEY}, label=${config.JIRA_DESIGN_LABEL}`);
    try {
        const stories = await fetchPendingStories();
        console.log(`Found ${stories.length} stories.`);
        stories.forEach(s => console.log(`- ${s.key}: ${s.fields.summary}`));
    } catch (err) {
        console.error('Test failed:', err);
    }
}

test();
