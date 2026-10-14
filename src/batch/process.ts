import {OperationError} from '../core/errors.ts';
import {join} from 'node:path';

export type ProcessOptions={cwd:string;timeoutMs:number;maxOutputBytes:number};
export type ProcessRunner=(command:string[],options:ProcessOptions)=>Promise<void>;
// Do not give the editor subprocess pairing secrets, provider keys, or the full
// harness environment. These entries are needed for executable/config discovery.
export function childEnvironment() {
  const environment:Record<string,string>={};
  for(const name of ['PATH','HOME','USERPROFILE','APPDATA','LOCALAPPDATA','SYSTEMROOT','WINDIR','TEMP','TMP','TMPDIR','XDG_CONFIG_HOME','XDG_DATA_HOME','LANG','LC_ALL'])
    if(process.env[name]!==undefined)environment[name]=process.env[name]!;
  return environment;
}
export async function runProcess(command:string[],options:ProcessOptions,spawn:typeof Bun.spawn=Bun.spawn) {
  let child:Bun.Subprocess<'ignore','pipe','pipe'>;
  try {child=spawn(command,{cwd:options.cwd,env:{...childEnvironment(),ASEPRITE_USER_FOLDER:join(options.cwd,'editor-config')},stdin:'ignore',stdout:'pipe',stderr:'pipe'});}
  catch {throw new OperationError('BATCH_START_FAILED','Could not start the configured Aseprite executable. Check its path and process permissions.');}
  let reason:OperationError|undefined,total=0;
  const readers=[child.stdout.getReader(),child.stderr.getReader()];
  const stop=(error:OperationError)=>{
    reason??=error;
    try{child.kill('SIGKILL');}catch{}
    for(const reader of readers)void reader.cancel().catch(()=>{});
  };
  const timer=setTimeout(()=>stop(new OperationError('BATCH_TIMEOUT','The file job timed out; it was not retried. Original inputs are not edited.')),options.timeoutMs);
  const consume=async(reader:(typeof readers)[number])=>{
    try {
      while(true){const item=await reader.read();if(item.done)break;total+=item.value.byteLength;
        if(total>options.maxOutputBytes){stop(new OperationError('BATCH_OUTPUT_LIMIT','The file job exceeded its output limit; no result was published.'));break;}}
    }catch{stop(new OperationError('BATCH_PROCESS_FAILED','Could not read bounded subprocess output.'));}
    finally{reader.releaseLock();}
  };
  try {
    const [exit]=await Promise.all([child.exited,consume(readers[0]!),consume(readers[1]!)]);
    if(reason)throw reason;
    if(exit!==0)throw new OperationError('BATCH_PROCESS_FAILED','Aseprite exited unsuccessfully; no successful job result was accepted.');
  }finally{clearTimeout(timer);}
}
