// Deliberately explicit secret display for the user at a private terminal.
// Do not invoke this script in agent logs or save its output in documentation.
import { resolve } from 'node:path';
import { readConnection } from '../src/setup/config.ts';
try {
  const config=await readConnection(resolve(import.meta.dir,'../.local/connection.json'));
  console.error(`Port: ${config.port}\nPairing token: ${config.token}`);
} catch {console.error('Could not read private pairing configuration. Run bun run setup and check its permissions.');process.exitCode=1;}
