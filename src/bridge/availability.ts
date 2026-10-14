import { EditorBridge } from './server.ts';
import { OperationError } from '../core/errors.ts';
import { z } from 'zod';

export type ManagedEditorBridge = Pick<EditorBridge, 'status' | 'call' | 'close'>;
export type ShareableEditorBridge = ManagedEditorBridge & {statusAsync?: () => Promise<ReturnType<EditorBridge['status']>>};
type BridgeFactory = (token: string, port: number) => ManagedEditorBridge;
const sharedStatus=z.object({connected:z.boolean(),sessionId:z.string().nullable(),editorVersion:z.string().nullable(),apiVersion:z.number().int().nullable(),extensionVersion:z.string().nullable(),capabilities:z.array(z.string()),outcomeUnknown:z.boolean(),recoveryDocumentId:z.string().nullable(),port:z.number().int()}).passthrough();
const remoteResponse = (value: unknown) => {
  if (!value || typeof value !== 'object' || !('ok' in value) || typeof value.ok !== 'boolean') throw new OperationError('INVALID_BRIDGE_RESPONSE','The editor bridge returned an invalid response.');
  if (!value.ok) {
    const error='error' in value && value.error && typeof value.error==='object' ? value.error : null;
    const code=error && 'code' in error && typeof error.code==='string' ? error.code : 'BRIDGE_ERROR';
    const message=error && 'message' in error && typeof error.message==='string' ? error.message : 'Shared editor bridge request failed.';
    throw new OperationError(code,message);
  }
  return 'result' in value ? value.result : undefined;
};
async function sharedRequest(token:string,port:number,request:Record<string,unknown>,mutating=false,send:typeof fetch=fetch):Promise<unknown> {
  // A failed capability/auth probe cannot have submitted an edit. Once the
  // edit itself is sent, transport ambiguity must instead be reported.
  if (mutating) await sharedRequest(token,port,{type:'status'},false,send);
  let response:Response;
  try {
    response=await send(`http://127.0.0.1:${port}/aseprite/client`,{
      method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
      body:JSON.stringify(request),signal:AbortSignal.timeout(60_000),
    });
  } catch {
    throw new OperationError(mutating?'OUTCOME_UNKNOWN':'LIVE_PORT_IN_USE',mutating?'Shared bridge connection failed during an edit. Inspect the target document before retrying.':`Local editor port ${port} is in use, but its owner could not be reached.`);
  }
  if (response.status===403||response.status===404) throw new OperationError('LIVE_PORT_IN_USE',`Local editor port ${port} is owned by a process that cannot share this paired session. Restart that MCP owner with the updated server, then reconnect Aseprite.`);
  if (!response.ok) throw new OperationError(mutating?'OUTCOME_UNKNOWN':'BRIDGE_UNAVAILABLE',`Shared editor bridge returned HTTP ${response.status}. ${mutating?'Inspect the target document before retrying.':'Check the owner process.'}`);
  let value:unknown;
  try { value=await response.json(); }
  catch { throw new OperationError(mutating?'OUTCOME_UNKNOWN':'INVALID_BRIDGE_RESPONSE',mutating?'Shared bridge reply was unreadable after an edit. Inspect the target document before retrying.':'Shared editor bridge returned unreadable JSON.'); }
  return remoteResponse(value);
}

// A second stdio process may share a compatible authenticated owner, but it
// never owns that owner's editor socket or closes it. Otherwise it keeps tool
// discovery available and can acquire the listener after its owner exits.
// Listing tools must not start a background port race or file fallback.
export function openEditorBridge(token: string, port: number, create: BridgeFactory = (key, localPort) => new EditorBridge(key, localPort), send:typeof fetch=fetch): {bridge:ShareableEditorBridge;portInUse:boolean} {
  try { return { bridge: create(token, port), portInUse: false }; }
  catch (error) {
    if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
    let acquired: ManagedEditorBridge | undefined;
    let closed = false;
    const requireBridge = (): ManagedEditorBridge => {
      if (closed) throw new OperationError('NOT_CONNECTED', 'This MCP editor bridge has been closed.');
      if (acquired) return acquired;
      // Construction is synchronous: concurrent calls cannot acquire two
      // listeners. Once acquired, preserve the bridge's queue/session/recovery
      // state; never recreate it to retry an editor operation.
      try { acquired = create(token, port); return acquired; }
      catch (error) {
        if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
        throw new OperationError('LIVE_PORT_IN_USE', `Local editor port ${port} is still in use. Use the session that owns it, or retry a live status check here after that session releases the port.`);
      }
    };
    const bridge: ShareableEditorBridge = {
      status: () => requireBridge().status(),
      statusAsync: async () => {
        try { return requireBridge().status(); }
        catch(error) {
          if (!(error instanceof OperationError)||error.code!=='LIVE_PORT_IN_USE') throw error;
          const parsed=sharedStatus.safeParse(await sharedRequest(token,port,{type:'status'},false,send));
          if(!parsed.success)throw new OperationError('INVALID_BRIDGE_RESPONSE','Shared editor bridge returned invalid status data.');
          return parsed.data as ReturnType<EditorBridge['status']>;
        }
      },
      call: async (method, params, mutating) => {
        let local:ManagedEditorBridge;
        try { local=requireBridge(); }
        catch(error) {
          if (!(error instanceof OperationError)||error.code!=='LIVE_PORT_IN_USE') throw error;
          return sharedRequest(token,port,{type:'call',method,params},mutating,send);
        }
        return local.call(method,params,mutating);
      },
      close: () => {
        if (closed) return;
        closed = true;
        acquired?.close(); // Release only a listener acquired by this copy.
      },
    };
    return { bridge, get portInUse() { return !closed && !acquired; } };
  }
}
