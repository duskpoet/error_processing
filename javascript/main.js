const originalProcessExit = process.exit;
process.exit = (code) => {
        console.log(`Process exit called with code: ${code}`);
}
import { readConfig } from './read_config.js';

function runServer(config) {
        console.log("Server is running with config:", config);
}

async function main() {
        const config = await readConfig('config.json');
        runServer(config);
        originalProcessExit(0);
}

main().catch(err => {
        console.error("Error starting server:", err);
        originalProcessExit(1);
});

