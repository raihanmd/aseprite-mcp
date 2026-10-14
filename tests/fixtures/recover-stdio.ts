// Production startup with a synthetic listener lifecycle, not a real editor.
import { startServer } from '../../src/mcp/server.ts';
import { openEditorBridge } from '../../src/bridge/availability.ts';
import { OperationError } from '../../src/core/errors.ts';
process.env.ASEPRITE_MCP_MODE='live';
process.env.ASEPRITE_MCP_TOKEN='t'.repeat(48);
let attempts=0;
await startServer((token,port)=>openEditorBridge(token,port,()=>{
  attempts++;
  if(attempts<=2)throw Object.assign(new Error('private synthetic bind diagnostic'),{code:'EADDRINUSE'});
  return {
    status:()=>({connected:false,sessionId:null,editorVersion:null,apiVersion:null,extensionVersion:null,compatibility:null,capabilities:[],outcomeUnknown:false,recoveryDocumentId:null,port,bindAttempts:attempts}),
    call:async()=>{throw new OperationError('NOT_CONNECTED','Synthetic recovered listener has no editor.');},
    close:()=>{},
  };
}));
