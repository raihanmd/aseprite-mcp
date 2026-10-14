// Production startup, synthetic occupied port; no actual socket/editor/token.
import { startServer } from '../../src/mcp/server.ts';
import { openEditorBridge } from '../../src/bridge/availability.ts';
process.env.ASEPRITE_MCP_MODE='live';
process.env.ASEPRITE_MCP_TOKEN='t'.repeat(48);
await startServer((token,port)=>openEditorBridge(token,port,()=>{throw Object.assign(new Error('private diagnostic'),{code:'EADDRINUSE'});}));
