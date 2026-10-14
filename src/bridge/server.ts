import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { OperationError, failure } from '../core/errors.ts';
import { schemas, mutating } from '../tools/contracts.ts';

const requiredConnectionFeatures=['apiVersion','editorUI','jsonDecode','jsonEncode','jsonMessages','websocket','websocketEvents','dialog','sprite','image','point','rgbMode','transaction','undo','redo','refresh','rgba'] as const;
const compatibilityReport=z.object({checkVersion:z.literal(1),ready:z.boolean(),features:z.record(z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,63}$/),z.boolean()).refine(value=>Object.keys(value).length<=32),missing:z.array(z.string().max(64)).max(32),workflowVerified:z.literal(false)}).strict();
const hello = z.object({ type: z.literal('hello'), bridgeVersion: z.literal(1), token: z.string().max(256), editorVersion: z.string().max(64), apiVersion: z.number().int().min(25), extensionVersion:z.string().max(64).optional(),compatibility:compatibilityReport.optional(),capabilities: z.array(z.string().max(64)).max(32) }).strict();
const response = z.object({ type: z.literal('response'), bridgeVersion: z.literal(1), sessionId: z.string(), id: z.string(), ok: z.boolean(), result: z.unknown().optional(), error: z.object({code: z.string().max(64), message: z.string().max(512)}).optional() }).strict();
const clientRequest = z.discriminatedUnion('type', [
  z.object({type:z.literal('status')}).strict(),
  z.object({type:z.literal('call'),method:z.string().min(1).max(64),params:z.record(z.string(),z.unknown())}).strict(),
]);
const saveCopy = z.object({documentId:z.string().min(1).max(80),stagingPath:z.string().min(1).max(4096)}).strict();
type SocketData = { authenticated: boolean; sessionId?: string; timer?: ReturnType<typeof setTimeout> };
type Pending = { socket: Bun.ServerWebSocket<SocketData>; documentId: string|null; resolve: (value: unknown) => void; reject: (e: Error) => void };

export class EditorBridge {
  readonly server: Bun.Server<SocketData>;
  private socket?: Bun.ServerWebSocket<SocketData>;
  private editor?: z.infer<typeof hello>;
  private pending = new Map<string, Pending>();
  private tail: Promise<void> = Promise.resolve();
  private queued = 0;
  private stopped = false;
  private uncertain = false;
  private recoveryDocumentId: string|null = null;
  constructor(private token: string, port = 32123, private timeoutMs = 10000, serve: typeof Bun.serve = Bun.serve) {
    if (token.length < 32) throw new OperationError('INVALID_TOKEN', 'Pairing token must contain at least 32 characters.');
    const bridge = this;
    this.server = serve<SocketData>({
      hostname: '127.0.0.1', port, maxRequestBodySize: 1024 * 1024,
      fetch(request, server) {
        const url = new URL(request.url);
        if (url.pathname === '/aseprite/client') return bridge.handleClient(request);
        // Aseprite's IXWebSocket client adds this native ws origin itself.
        // Browser origins use http(s); do not accept arbitrary loopback origins.
        // The first message still has to authenticate with the private token.
        const origin = request.headers.get('origin');
        if (url.pathname !== '/aseprite' || (origin !== null && origin !== `ws://127.0.0.1:${server.port}`))
          return new Response('Forbidden', {status:403});
        if (!server.upgrade(request, {data:{authenticated:false}})) return new Response('WebSocket required', {status:400});
        return undefined;
      },
      websocket: {
        maxPayloadLength: 1024 * 1024, idleTimeout: 0, perMessageDeflate: false,
        open(ws) { ws.data.timer = setTimeout(() => ws.close(1008, 'Authentication timeout'), 5000); },
        message(ws, raw) { bridge.receive(ws, raw); },
        close(ws) { clearTimeout(ws.data.timer); bridge.disconnect(ws); },
      },
    });
  }
  private async handleClient(request:Request):Promise<Response> {
    if (request.method !== 'POST' || request.headers.has('origin')) return new Response('Forbidden', {status:403});
    const authorization=request.headers.get('authorization')??'';
    const supplied=authorization.startsWith('Bearer ')?Buffer.from(authorization.slice(7)):Buffer.alloc(0);
    const expected=Buffer.from(this.token);
    if (supplied.length!==expected.length||!timingSafeEqual(supplied,expected)) return new Response('Forbidden', {status:403});
    try {
      const body=clientRequest.parse(await request.json());
      if (body.type==='status') return Response.json({ok:true,result:this.status()});
      const schema=body.method==='save_copy'?saveCopy:schemas[body.method as keyof typeof schemas];
      if (!schema) throw new OperationError('UNKNOWN_OPERATION','Unsupported editor operation.');
      const params=schema.parse(body.params);
      if (body.method==='get_editor_status'||body.method==='get_animation_preview'||body.method==='draw_shapes') throw new OperationError('UNKNOWN_OPERATION','This operation is handled by the MCP server.');
      const result=await this.call(body.method,params,mutating.has(body.method));
      return Response.json({ok:true,result});
    } catch(error) { return Response.json(failure(error)); }
  }
  status() { return {connected: !!this.socket, sessionId: this.socket?.data.sessionId ?? null, editorVersion: this.editor?.editorVersion ?? null, apiVersion: this.editor?.apiVersion ?? null, extensionVersion:this.editor?.extensionVersion??null,compatibility:this.editor?.compatibility??null, capabilities: this.editor?.capabilities ?? [], outcomeUnknown: this.uncertain, recoveryDocumentId:this.recoveryDocumentId, port:this.server.port}; }
  private receive(ws: Bun.ServerWebSocket<SocketData>, raw: string | Buffer) {
    try {
      if (typeof raw !== 'string') throw new Error('Text messages required');
      const value: unknown = JSON.parse(raw);
      if (!ws.data.authenticated) {
        const parsed = hello.parse(value);
        const actual = Buffer.from(parsed.token), expected = Buffer.from(this.token);
        if (actual.length !== expected.length || !timingSafeEqual(actual, expected) || this.socket) throw new Error('Pairing rejected');
        if (parsed.compatibility && (!parsed.compatibility.ready||parsed.compatibility.missing.length||requiredConnectionFeatures.some(name=>parsed.compatibility!.features[name]!==true)||Object.values(parsed.compatibility.features).some(value=>!value))) throw new Error('Editor compatibility check failed');
        clearTimeout(ws.data.timer);
        ws.data.authenticated = true; ws.data.sessionId = crypto.randomUUID();
        this.socket = ws; this.editor = {...parsed, token:''};
        ws.send(JSON.stringify({type:'hello_ack',bridgeVersion:1,sessionId:ws.data.sessionId}));
        return;
      }
      const reply = response.parse(value);
      if (ws !== this.socket || reply.sessionId !== ws.data.sessionId) throw new Error('Wrong session');
      const pending = this.pending.get(reply.id);
      if (!pending) return; // Late reply to a timed-out request is not a new success.
      this.pending.delete(reply.id);
      if (reply.ok) pending.resolve(reply.result);
      else pending.reject(new OperationError(reply.error?.code ?? 'COMMAND_FAILED', reply.error?.message ?? 'Editor operation failed.'));
    } catch { ws.close(1008, 'Invalid editor message'); }
  }
  private disconnect(ws: Bun.ServerWebSocket<SocketData>) {
    if (ws === this.socket) { this.socket = undefined; this.editor = undefined; }
    for (const [id, pending] of this.pending) if (pending.socket === ws) {
      this.pending.delete(id);
      // A failed recovery read must not replace the original affected target.
      if (!this.uncertain) {this.uncertain = true;this.recoveryDocumentId = pending.documentId;}
      pending.reject(new OperationError('OUTCOME_UNKNOWN','Editor disconnected during a request. Inspect the document before retrying.'));
    }
  }
  async call(method: string, params: Record<string,unknown>, mutating = false): Promise<unknown> {
    const socket = this.socket;
    if (this.stopped || !socket) throw new OperationError('NOT_CONNECTED','Connect the Aseprite extension before using live tools.');
    if (!this.editor?.capabilities.includes(method)) throw new OperationError('UNSUPPORTED_API','The editor does not advertise this operation.');
    if (this.queued >= 32) throw new OperationError('QUEUE_FULL','Too many editor requests are queued.');
    this.queued++;
    const predecessor = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => {release=resolve;});
    try {
      await predecessor;
      if (socket !== this.socket) throw new OperationError('STALE_SESSION','Editor session changed while the request was queued.');
      if (mutating && this.uncertain) throw new OperationError('OUTCOME_UNKNOWN','Inspect current document state before sending another edit.');
      const id = crypto.randomUUID();
      const documentId = typeof params.documentId==='string' ? params.documentId : null;
      const encoded = JSON.stringify({type:'request',bridgeVersion:1,sessionId:socket.data.sessionId,id,method,params});
      if (Buffer.byteLength(encoded) > 1024*1024) throw new OperationError('INVALID_ARGUMENT','Editor request exceeds the message size limit.');
      const result = await new Promise<unknown>((resolve,reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(id); if (mutating) {this.uncertain = true;this.recoveryDocumentId=documentId;}
          reject(new OperationError(mutating ? 'OUTCOME_UNKNOWN' : 'TIMEOUT','Editor did not reply. Inspect current state; edits are never retried automatically.'));
        },this.timeoutMs);
        this.pending.set(id,{socket,documentId,resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
        const sent = socket.send(encoded);
        if (sent === 0) { this.pending.delete(id); clearTimeout(timer); reject(new OperationError('NOT_CONNECTED','Request could not be sent.')); }
      });
      if (method === 'get_document_info' && (!this.recoveryDocumentId || documentId===this.recoveryDocumentId)) {
        this.uncertain = false;this.recoveryDocumentId=null;
      }
      return result;
    } finally { this.queued--; release(); }
  }
  close() { this.stopped=true; const socket=this.socket; if(socket) {this.disconnect(socket);socket.close();} this.server.stop(true); }
}
