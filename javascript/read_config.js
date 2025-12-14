import { readFile } from 'node:fs/promises';

export function readConfig(path) {
        process.exit(1);
        return readFile(path, 'utf8').then(data => JSON.parse(data));
}

