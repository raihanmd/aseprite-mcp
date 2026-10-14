// Official SDK stdio fixture without a network listener. Not a production backend.
import { createMcp } from '../../src/mcp/server.ts';
import { ProjectFiles } from '../../src/security/files.ts';
import { OperationError } from '../../src/core/errors.ts';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const bridge={status:()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port:0}),call:async()=>{throw new OperationError('NOT_CONNECTED','Test fixture has no editor connection.');}};
const files=await ProjectFiles.create(process.env.ASEPRITE_MCP_ASSETS!);
const server=createMcp(bridge,files);
await server.connect(new StdioServerTransport());
// The real server has a listening socket; this disconnected fixture needs its own lifetime.
const lifetime=setInterval(()=>{},1000);
process.stdin.once('end',()=>{clearInterval(lifetime);void server.close();});
