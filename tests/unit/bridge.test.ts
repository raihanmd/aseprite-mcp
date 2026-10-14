import { afterEach,expect,test } from 'bun:test';
import { EditorBridge } from '../../src/bridge/server.ts';
const token='t'.repeat(48), bridges:EditorBridge[]=[];
const readyReport=()=>({checkVersion:1,ready:true,features:Object.fromEntries(['apiVersion','editorUI','jsonDecode','jsonEncode','jsonMessages','websocket','websocketEvents','dialog','sprite','image','point','rgbMode','transaction','undo','redo','refresh','rgba'].map(name=>[name,true])),missing:[],workflowVerified:false});
afterEach(()=>{for(const b of bridges.splice(0))b.close();});
function fixture(timeout=100) {
  let options:any;const sent:any[]=[];let handler:(request:any)=>void=()=>{};
  const serve=((o:any)=>{options=o;return {port:32123,stop:()=>{}};}) as typeof Bun.serve;
  const bridge=new EditorBridge(token,32123,timeout,serve);bridges.push(bridge);
  const socket={data:{authenticated:false},send:(raw:string)=>{const m=JSON.parse(raw);sent.push(m);if(m.type==='request')handler(m);return raw.length;},close:()=>options.websocket.close(socket)};
  const message=(m:unknown)=>options.websocket.message(socket,JSON.stringify(m));
  const authenticate=(provided=token,extra:Record<string,unknown>={})=>{options.websocket.open(socket);message({type:'hello',bridgeVersion:1,token:provided,editorVersion:'mock',apiVersion:39,capabilities:['get_document_info','draw_pixels','list_documents'],...extra});};
  const reply=(m:any,result:unknown={})=>message({type:'response',bridgeVersion:1,sessionId:m.sessionId,id:m.id,ok:true,result});
  return {bridge,socket,message,authenticate,reply,sent,onRequest:(fn:(request:any)=>void)=>{handler=fn;},options};
}
test('state machine refuses disconnected and unsupported operations',async()=>{
  const f=fixture();await expect(f.bridge.call('draw_pixels',{},true)).rejects.toMatchObject({code:'NOT_CONNECTED'});
  f.authenticate();expect(f.bridge.status().connected).toBe(true);await expect(f.bridge.call('execute_lua',{},true)).rejects.toMatchObject({code:'UNSUPPORTED_API'});
});
test('future editor API levels are not exact-version blocked and detected checks are not claimed as workflow tests',()=>{
  const f=fixture();
  f.authenticate(token,{editorVersion:'future-mock',apiVersion:100,extensionVersion:'0.1.1',compatibility:readyReport()});
  expect(f.bridge.status()).toMatchObject({connected:true,apiVersion:100,extensionVersion:'0.1.1',compatibility:{ready:true,workflowVerified:false}});
});
test('failed or contradictory compatibility reports and mismatched bridge versions cannot pair',()=>{
  for(const extra of [
    {compatibility:{checkVersion:1,ready:false,features:{jsonMessages:false},missing:['jsonMessages'],workflowVerified:false}},
    {compatibility:{checkVersion:1,ready:true,features:{transaction:false},missing:[],workflowVerified:false}},
    {compatibility:{...readyReport(),features:{}}},
    {compatibility:{...readyReport(),features:{transaction:true,jsonMessages:true}}},
    {bridgeVersion:2}, {apiVersion:24},
  ]) {
    const f=fixture();f.authenticate(token,extra);expect(f.bridge.status().connected).toBe(false);
  }
});
test('pairing rejects wrong tokens and binary messages',()=>{
  const f=fixture();f.authenticate('x'.repeat(48));expect(f.bridge.status().connected).toBe(false);
  f.authenticate();expect(f.bridge.status().connected).toBe(true);
  f.options.websocket.message(f.socket,Buffer.from('{}'));
  expect(f.bridge.status().connected).toBe(false);
});
test('native Aseprite origin and origin-less SDK clients can upgrade but still require pairing',()=>{
  const f=fixture();let upgrades=0;
  const server={port:32123,upgrade:()=>{upgrades++;return true;}};
  for(const origin of [undefined,'ws://127.0.0.1:32123']) {
    const request=new Request('http://127.0.0.1:32123/aseprite',{headers:origin===undefined?{}:{Origin:origin}});
    expect(f.options.fetch(request,server)).toBeUndefined();
  }
  expect(upgrades).toBe(2);expect(f.bridge.status().connected).toBe(false);
  f.authenticate('x'.repeat(48));expect(f.bridge.status().connected).toBe(false);
  f.authenticate();expect(f.bridge.status().connected).toBe(true);
});
test('native origin must match the actual listening port, including an allocated port',()=>{
  const f=fixture();const server={port:43210,upgrade:()=>true};
  const request=(origin:string)=>new Request('http://127.0.0.1:43210/aseprite',{headers:{Origin:origin}});
  expect(f.options.fetch(request('ws://127.0.0.1:43210'),server)).toBeUndefined();
  expect(f.options.fetch(request('ws://127.0.0.1:32123'),server).status).toBe(403);
});
test('browser, foreign, malformed origins and wrong paths cannot upgrade',()=>{
  const f=fixture();let upgrades=0;const server={port:32123,upgrade:()=>{upgrades++;return true;}};
  for(const origin of [
    'https://example.com','http://127.0.0.1:32123','https://127.0.0.1:32123','null','',
    'ws://localhost:32123','ws://127.0.0.1:32124','ws://127.0.0.1:32123/',
    'ws://127.0.0.1:32123.evil.example','ws://127.0.0.1:32123@evil.example',
    'ws://127.0.0.1:32123, https://example.com',
  ]) {
    const request=new Request('http://127.0.0.1:32123/aseprite',{headers:{Origin:origin}});
    expect(f.options.fetch(request,server).status).toBe(403);
  }
  expect(f.options.fetch(new Request('http://127.0.0.1:32123/wrong',{headers:{Origin:'ws://127.0.0.1:32123'}}),server).status).toBe(403);
  expect(upgrades).toBe(0);
});
test('shared-client endpoint authenticates, validates methods, and enters the owner queue',async()=>{
  const f=fixture();f.authenticate();f.onRequest(m=>f.reply(m,{documents:[]}));
  const send=(body:unknown,authorization?:string,origin?:string)=>f.options.fetch(new Request('http://127.0.0.1:32123/aseprite/client',{
    method:'POST',headers:{'content-type':'application/json',...(authorization?{authorization}:{}),...(origin?{origin}:{})},body:JSON.stringify(body),
  }),{port:32123});
  for(const [authorization,origin] of [[undefined,undefined],['Bearer '+'x'.repeat(48),undefined],['Bearer '+token,'http://127.0.0.1:3000']] as const) {
    const response=await send({type:'status'},authorization,origin);
    expect(response.status).toBe(403);
  }
  const status=await send({type:'status'},'Bearer '+token);
  expect(await status.json()).toMatchObject({ok:true,result:{connected:true,sessionId:f.bridge.status().sessionId}});
  const rejected=await send({type:'call',method:'execute_lua',params:{}},'Bearer '+token);
  expect(await rejected.json()).toMatchObject({ok:false,error:{code:'UNKNOWN_OPERATION'}});
  const result=await send({type:'call',method:'list_documents',params:{}},'Bearer '+token);
  expect(await result.json()).toEqual({ok:true,result:{documents:[]}});
  expect(f.sent.filter(m=>m.type==='request').map(m=>m.method)).toEqual(['list_documents']);
});
test('mock transport verifies timeout, no mutation retry, and inspection recovery',async()=>{
  const f=fixture(10);f.authenticate();
  await expect(f.bridge.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  await expect(f.bridge.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  expect(f.sent.filter(m=>m.type==='request')).toHaveLength(1);
  f.onRequest(m=>f.reply(m,{documentId:'s'}));await f.bridge.call('get_document_info',{documentId:'s'});expect(f.bridge.status().outcomeUnknown).toBe(false);
});
test('queue captures targets and serializes editor operations',async()=>{
  const f=fixture();f.authenticate();let active=0,max=0;
  f.onRequest(m=>{active++;max=Math.max(max,active);setTimeout(()=>{active--;f.reply(m);},5);});
  await Promise.all([f.bridge.call('list_documents',{}),f.bridge.call('get_document_info',{documentId:'specific'})]);expect(max).toBe(1);expect(f.sent.at(-1).params.documentId).toBe('specific');
});
test('reconnection and inspection of another document cannot clear an uncertain edit',async()=>{
  const f=fixture(10);f.authenticate();
  await expect(f.bridge.call('draw_pixels',{documentId:'sprite-A'},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  expect(f.bridge.status().recoveryDocumentId).toBe('sprite-A');
  f.socket.close();f.socket.data.authenticated=false;f.authenticate();
  expect(f.bridge.status().outcomeUnknown).toBe(true);
  f.onRequest(()=>f.socket.close());
  await expect(f.bridge.call('get_document_info',{documentId:'sprite-B'})).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  expect(f.bridge.status().recoveryDocumentId).toBe('sprite-A');
  f.socket.data.authenticated=false;f.authenticate();
  f.onRequest(m=>f.reply(m,{documentId:m.params.documentId}));
  await f.bridge.call('get_document_info',{documentId:'sprite-B'});
  await expect(f.bridge.call('draw_pixels',{documentId:'sprite-A'},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
  await f.bridge.call('get_document_info',{documentId:'sprite-A'});
  expect(f.bridge.status().outcomeUnknown).toBe(false);expect(f.bridge.status().recoveryDocumentId).toBeNull();
  await f.bridge.call('draw_pixels',{documentId:'sprite-A'},true);
});
test('wrong-session reply causes an unknown outcome, not success',async()=>{
  const f=fixture();f.authenticate();f.onRequest(m=>f.message({type:'response',bridgeVersion:1,sessionId:'wrong',id:m.id,ok:true,result:{}}));
  await expect(f.bridge.call('draw_pixels',{},true)).rejects.toMatchObject({code:'OUTCOME_UNKNOWN'});
});
test('queued edits never follow a reconnected editor',async()=>{
  const f=fixture(20);f.authenticate();const first=f.bridge.call('list_documents',{}).catch(error=>error);const queued=f.bridge.call('draw_pixels',{},true).catch(error=>error);
  await Bun.sleep(1);f.socket.close();
  expect(await first).toMatchObject({code:'OUTCOME_UNKNOWN'});expect(await queued).toMatchObject({code:'STALE_SESSION'});
});
