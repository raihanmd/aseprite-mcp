import { constants } from 'node:fs';
import { mkdir, lstat, open, access } from 'node:fs/promises';
import { resolve, join, isAbsolute } from 'node:path';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { OperationError } from '../core/errors.ts';

const connectionSchema=z.object({
  version:z.literal(1),token:z.string().regex(/^[a-f0-9]{64}$/),
  port:z.number().int().min(1024).max(65535),
  assets:z.string().refine(isAbsolute,'Asset directory must be absolute.'),
}).strict();
export type ConnectionConfig=z.infer<typeof connectionSchema>;
const executableSchema=z.object({version:z.literal(1),path:z.string().refine(isAbsolute,'Executable path must be absolute.')}).strict();
export async function readExecutable(root:string):Promise<string|null> {
  let file;
  try{file=await open(resolve(root,'.local/executable.json'),constants.O_RDONLY|constants.O_NOFOLLOW);}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}
  try{
    const info=await file.stat();
    if(!info.isFile()||info.size>4096||info.mode&0o077||(process.getuid&&info.uid!==process.getuid()))throw new OperationError('INSECURE_CONFIG','Executable configuration must be private and owner-controlled.');
    try{return executableSchema.parse(JSON.parse(await file.readFile('utf8'))).path;}
    catch{throw new OperationError('INVALID_CONFIG','Invalid local executable configuration.');}
  }finally{await file.close();}
}
export async function prepareExecutable(root:string,path:string){
  const config=executableSchema.parse({version:1,path});
  await access(path,process.platform==='win32'?constants.F_OK:constants.X_OK);
  const directory=resolve(root,'.local');await mkdir(directory,{recursive:true,mode:0o700});
  const info=await lstat(directory);
  if(!info.isDirectory()||info.mode&0o077||(process.getuid&&info.uid!==process.getuid()))throw new OperationError('INSECURE_CONFIG','Local executable setup requires a private directory, not a symlink.');
  await writeGenerated(resolve(directory,'executable.json'),JSON.stringify(config)+'\n');
  return readExecutable(root);
}
export async function readConnection(path:string):Promise<ConnectionConfig> {
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try {
    const info=await file.stat();
    if(!info.isFile()||info.size>4096||info.mode&0o077||(process.getuid&&info.uid!==process.getuid()))
      throw new OperationError('INSECURE_CONFIG','Pairing configuration must be a private, owner-controlled regular file (mode 600).');
    try {return connectionSchema.parse(JSON.parse(await file.readFile('utf8')));}
    catch {throw new OperationError('INVALID_CONFIG','Invalid pairing configuration. Do not put its contents in logs.');}
  } finally {await file.close();}
}
async function writeNew(path:string,content:string,mode=0o600) {
  const file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,mode);
  try {await file.writeFile(content);await file.sync();} finally {await file.close();}
}
async function writeGenerated(path:string,content:string) {
  try {await writeNew(path,content);} catch(error) {
    if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
    const info=await lstat(path);
    if(!info.isFile()||info.size>16384||await Bun.file(path).text()!==content)
      throw new OperationError('CONFIG_EXISTS','Generated client entry already exists with different contents. It was not overwritten.');
  }
}
export async function prepareSetup(root:string,bunPath:string,port=32123) {
  if(!isAbsolute(bunPath))throw new OperationError('INVALID_PATH','Use an absolute Bun executable path.');
  // Validate options before creating anything.
  connectionSchema.omit({token:true}).parse({version:1,port,assets:resolve(root,'assets')});
  const local=resolve(root,'.local');await mkdir(local,{recursive:true,mode:0o700});
  const info=await lstat(local);
  if(!info.isDirectory()||info.mode&0o077||(process.getuid&&info.uid!==process.getuid()))
    throw new OperationError('INSECURE_CONFIG','The local setup directory must be private and not a symlink (mode 700).');
  const path=join(local,'connection.json');
  try {await writeNew(path,JSON.stringify({version:1,token:randomBytes(32).toString('hex'),port,assets:resolve(root,'assets')})+'\n');}
  catch(error) {if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;}
  const config=await readConnection(path);
  if(config.port!==port)throw new OperationError('CONFIG_EXISTS','Existing setup uses another port; it was not changed.');
  await mkdir(config.assets,{recursive:true,mode:0o700});
  const directory=resolve(root,'install');await mkdir(directory,{recursive:true,mode:0o700});
  const command=[bunPath,resolve(root,'scripts/launch.ts')];
  // JSON quoting is valid for these TOML basic strings and arrays too.
  const codex=`[mcp_servers.aseprite]\ncommand = ${JSON.stringify(command[0])}\nargs = ${JSON.stringify(command.slice(1))}\n`;
  const opencode=JSON.stringify({$schema:'https://opencode.ai/config.json',mcp:{aseprite:{type:'local',command,enabled:true}}},null,2)+'\n';
  await writeGenerated(join(directory,'codex.toml'),codex);
  await writeGenerated(join(directory,'opencode.json'),opencode);
  return {path,port:config.port,assets:config.assets,clientEntries:directory};
}
