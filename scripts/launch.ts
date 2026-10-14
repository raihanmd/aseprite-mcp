import { resolve } from 'node:path';
import { readConnection,readExecutable } from '../src/setup/config.ts';
import { startServer } from '../src/mcp/server.ts';
import { failure } from '../src/core/errors.ts';
try {
  const config=await readConnection(resolve(import.meta.dir,'../.local/connection.json'));
  process.env.ASEPRITE_MCP_TOKEN=config.token;
  process.env.ASEPRITE_MCP_PORT=String(config.port);
  process.env.ASEPRITE_MCP_ASSETS=config.assets;
  const executable=await readExecutable(resolve(import.meta.dir,'..'));
  if(process.env.ASEPRITE_MCP_EXECUTABLE===undefined&&executable)process.env.ASEPRITE_MCP_EXECUTABLE=executable;
  await startServer();
} catch(error) {
  const code=(error as NodeJS.ErrnoException).code;
  const message=code==='EPERM'||code==='EACCES'?'Local listener or setup-file access was denied. Run in an environment that permits this local integration.':code==='EADDRINUSE'?'The local port is already in use. Stop the other MCP client before switching clients.':code==='ENOENT'?'Local setup is missing. Run bun run setup first.':failure(error).error.message;
  console.error(message);process.exitCode=1;
}
