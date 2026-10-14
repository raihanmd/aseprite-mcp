import {constants} from 'node:fs';
import {access,lstat,mkdir,open,readdir,rename,unlink} from 'node:fs/promises';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {OperationError} from '../core/errors.ts';
import {mergeCodex,mergeOpenCode} from './merge.ts';

const skillName='aseprite-pixel-art';
const hash=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
type Snapshot={path:string;bytes:Buffer|null;sha256:string|null;mode:number};
type ConfigChange={before:Snapshot;after:Buffer;client:'codex'|'opencode'};
type SkillFile={relative:string;bytes:Buffer;sha256:string};
export type HarnessOptions={root:string;bunPath:string;userHome?:string;codexDirectory?:string;opencodeDirectory?:string};
export type HarnessPlan={root:string;configs:ConfigChange[];skill:{path:string;files:SkillFile[];exists:boolean};duplicatePaths:string[]};
async function read(path:string,maximum=1024*1024):Promise<Snapshot> {
  let file;
  // Nonblocking open lets the descriptor check reject a FIFO/device rather
  // than hang before discovering that it is not a regular file (Linux).
  try{file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {path,bytes:null,sha256:null,mode:0o600};throw new OperationError('CONFIG_ACCESS','Cannot safely read an installation target. Check its path and permissions.');}
  try {
    const info=await file.stat();
    if(!info.isFile()||info.size>maximum||(process.getuid&&info.uid!==process.getuid()))throw new OperationError('CONFIG_ACCESS','Installation inputs must be bounded, owner-controlled regular files.');
    const bytes=await file.readFile();const after=await file.stat();
    if(bytes.length>maximum||after.size!==info.size||after.mtimeMs!==info.mtimeMs)throw new OperationError('STALE_CONFIG','Configuration changed while reading. Run the installer again.');
    return {path,bytes,sha256:hash(bytes),mode:info.mode&0o777};
  }finally{await file.close();}
}
async function present(path:string) {
  try{await lstat(path);return true;}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return false;throw error;}
}
function discoveryPaths(root:string,userHome:string,codex:string,opencode:string) {
  return [...new Set([join(codex,'skills'),join(opencode,'skills'),join(opencode,'skill'),join(userHome,'.claude/skills'),join(root,'.agents/skills'),join(root,'.codex/skills'),join(root,'.opencode/skills'),join(root,'.opencode/skill'),join(root,'.claude/skills')].map(path=>join(path,skillName)))].filter(path=>path!==join(userHome,'.agents/skills',skillName));
}
async function tree(path:string,relative=''):Promise<SkillFile[]> {
  const info=await lstat(path);
  if(!info.isDirectory()||info.isSymbolicLink())throw new OperationError('SKILL_CONFLICT','Skill folders must be ordinary directories, not symlinks.');
  const result:SkillFile[]=[];
  for(const name of (await readdir(path)).sort()) {
    const full=join(path,name),rel=join(relative,name),item=await lstat(full);
    if(item.isDirectory())result.push(...await tree(full,rel));
    else {
      const file=await read(full);if(!file.bytes)throw new OperationError('STALE_SKILL','A skill file disappeared.');
      result.push({relative:rel,bytes:file.bytes,sha256:file.sha256!});
    }
    if(result.length>100)throw new OperationError('SKILL_LIMIT','Skill exceeds the installation file limit.');
  }
  return result;
}
async function assertSkill(plan:HarnessPlan) {
  const exists=await present(plan.skill.path);
  if(exists!==plan.skill.exists)throw new OperationError('STALE_SKILL','The skill destination changed. Run the installer again.');
  if(exists) {
    const current=await tree(plan.skill.path);
    if(current.length!==plan.skill.files.length||current.some((file,index)=>file.relative!==plan.skill.files[index]?.relative||file.sha256!==plan.skill.files[index]?.sha256))throw new OperationError('SKILL_CONFLICT','An installed skill differs from the maintained copy. It was not overwritten.');
  }
  for(const path of plan.duplicatePaths)if(await present(path))throw new OperationError('SKILL_CONFLICT','Another same-name skill exists in a known discovery location. Resolve it before installation.');
}
export async function planHarness(options:HarnessOptions):Promise<HarnessPlan> {
  const root=resolve(options.root),userHome=options.userHome??homedir();
  const codex=options.codexDirectory??process.env.CODEX_HOME??join(userHome,'.codex');
  const opencode=options.opencodeDirectory??join(process.env.XDG_CONFIG_HOME??join(userHome,'.config'),'opencode');
  if(![userHome,codex,opencode,options.bunPath].every(isAbsolute))throw new OperationError('INVALID_PATH','Installer paths must be absolute.');
  await access(options.bunPath,constants.X_OK);await access(join(root,'scripts/launch.ts'),constants.R_OK);
  // Setup must already exist, but never load or print its pairing secret here.
  const setup=await lstat(join(root,'.local/connection.json'));
  if(!setup.isFile()||setup.isSymbolicLink()||setup.mode&0o077)throw new OperationError('INSECURE_CONFIG','Run private local setup before installing clients.');
  const json=join(opencode,'opencode.json'),jsonc=join(opencode,'opencode.jsonc');
  if(await present(json)&&await present(jsonc))throw new OperationError('CONFIG_CONFLICT','Both OpenCode JSON and JSONC files exist. Choose the intended file explicitly before installation.');
  const command=[options.bunPath,join(root,'scripts/launch.ts')];
  const configs:ConfigChange[]=[];
  for(const [client,path] of [['codex',join(codex,'config.toml')],['opencode',await present(jsonc)?jsonc:json]] as const) {
    const before=await read(path),text=before.bytes?.toString('utf8')??(client==='codex'?'':'{}\n');
    const merged=client==='codex'?mergeCodex(text,command):mergeOpenCode(text,command);
    configs.push({before,after:Buffer.from(merged),client});
  }
  const skillPath=join(userHome,'.agents/skills',skillName),files=await tree(join(root,'skills',skillName));
  if(!files.some(file=>file.relative==='SKILL.md'))throw new OperationError('INVALID_SKILL','Maintained skill is missing its instructions.');
  const duplicatePaths=discoveryPaths(root,userHome,codex,opencode);
  const plan={root,configs,skill:{path:skillPath,files,exists:await present(skillPath)},duplicatePaths};
  await assertSkill(plan);return plan;
}
export function installationReport(plan:HarnessPlan) {
  return {scope:'global',applied:false,configs:plan.configs.map(item=>({client:item.client,path:item.before.path,change:item.before.sha256!==hash(item.after)})),skill:{path:plan.skill.path,change:!plan.skill.exists,files:plan.skill.files.map(file=>({path:file.relative,sha256:file.sha256}))},clientAcceptanceVerified:false,liveEditorVerified:false};
}
async function safeDirectory(path:string) {
  const parent=dirname(path);if(parent!==path)await safeDirectory(parent);
  if(!await present(path))await mkdir(path,{mode:0o700});
  const info=await lstat(path);
  if(!info.isDirectory()||info.isSymbolicLink())throw new OperationError('UNSAFE_PATH','Installation paths must not contain symlinked directories.');
  // System-owned ancestors such as /home and /tmp are allowed; target parents
  // are checked separately for ownership. Sticky /tmp is not a private backup.
}
async function ownerDirectory(path:string) {
  await safeDirectory(path);const info=await lstat(path);
  if(info.mode&0o022||(process.getuid&&info.uid!==process.getuid()))throw new OperationError('UNSAFE_PATH','Installation target directory must be owner-controlled and not writable by others.');
}
async function writeNew(path:string,bytes:Uint8Array,mode=0o600) {
  const file=await open(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,mode);
  try{await file.writeFile(bytes);await file.sync();}finally{await file.close();}
}
async function unchanged(snapshot:Snapshot) {
  if((await read(snapshot.path)).sha256!==snapshot.sha256)throw new OperationError('STALE_CONFIG','Client settings changed after planning. Nothing was intentionally overwritten; inspect any reported partial installation.');
}
export async function applyHarness(plan:HarnessPlan) {
  for(const item of plan.configs)await unchanged(item.before);
  await assertSkill(plan);
  const changed=plan.configs.filter(item=>item.before.sha256!==hash(item.after));
  if(!changed.length&&plan.skill.exists)return {...installationReport(plan),applied:true,changed:false,backupDirectory:null};
  for(const item of changed)await ownerDirectory(dirname(item.before.path));
  if(!plan.skill.exists)await ownerDirectory(dirname(plan.skill.path));
  const local=join(plan.root,'.local');await ownerDirectory(local);
  const localInfo=await lstat(local);if(localInfo.mode&0o077)throw new OperationError('INSECURE_CONFIG','Private backups require a mode-700 local setup folder.');
  const backups=join(local,'install-backups');await ownerDirectory(backups);
  if((await lstat(backups)).mode&0o077)throw new OperationError('INSECURE_CONFIG','The backup parent must be private.');
  const backupDirectory=join(backups,randomUUID());await mkdir(backupDirectory,{mode:0o700});
  const receipt={version:1,scope:'global',createdAt:new Date().toISOString(),status:'prepared',configs:changed.map(item=>({client:item.client,path:item.before.path,beforeSha256:item.before.sha256,afterSha256:hash(item.after),backup:item.before.bytes?`${item.client}.before`:null})),skill:{path:plan.skill.path,created:!plan.skill.exists,files:plan.skill.files.map(file=>({path:file.relative,sha256:file.sha256}))}};
  for(const item of changed)if(item.before.bytes)await writeNew(join(backupDirectory,`${item.client}.before`),item.before.bytes);
  await writeNew(join(backupDirectory,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
  const completed:string[]=[];
  try {
    for(const item of plan.configs)await unchanged(item.before);
    await assertSkill(plan);
    if(!plan.skill.exists) {
      await mkdir(plan.skill.path,{mode:0o700});completed.push(plan.skill.path);
      for(const file of plan.skill.files){const path=join(plan.skill.path,file.relative);await ownerDirectory(dirname(path));await writeNew(path,file.bytes);}
    }
    for(const item of changed) {
      const temporary=join(dirname(item.before.path),`.aseprite-mcp-${randomUUID()}.tmp`);
      await writeNew(temporary,item.after,item.before.mode&0o777);
      try{await unchanged(item.before);await rename(temporary,item.before.path);completed.push(item.before.path);}
      catch(error){await unlink(temporary).catch(()=>{});throw error;}
      if((await read(item.before.path)).sha256!==hash(item.after))throw new OperationError('INSTALL_VERIFY_FAILED','Client settings changed during installation.');
    }
    await assertSkill({...plan,skill:{...plan.skill,exists:true}});
    // Receipt status is appended separately; never overwrite the original plan.
    await writeNew(join(backupDirectory,'complete.json'),Buffer.from(JSON.stringify({completed,completedAt:new Date().toISOString()})+'\n'));
    return {...installationReport(plan),applied:true,changed:true,backupDirectory};
  }catch {
    throw new OperationError('PARTIAL_INSTALL',`Installation did not finish. Retained backups/receipt: ${backupDirectory}. Changed or started targets: ${completed.join(', ')||'none'}. Inspect before retrying; no automatic rollback was attempted.`);
  }
}

// Skill updates are deliberately separate from initial installation: no client
// settings or pairing data are read, merged, or written in this path.
export type SkillUpdateOptions=Omit<HarnessOptions,'bunPath'>;
export type SkillUpdatePlan={root:string;path:string;before:SkillFile[];files:SkillFile[];duplicatePaths:string[]};
const sameFiles=(left:SkillFile[],right:SkillFile[])=>left.length===right.length&&left.every((file,index)=>file.relative===right[index]?.relative&&file.sha256===right[index]?.sha256);
async function existingDirectory(path:string,privateOnly=false) {
  for(let current=path;;current=dirname(current)) {
    const info=await lstat(current);
    if(!info.isDirectory()||info.isSymbolicLink())throw new OperationError('UNSAFE_PATH','Skill update paths must not contain symlinked directories.');
    if(current===path&&((info.mode&0o022)||(process.getuid&&info.uid!==process.getuid())||(privateOnly&&(info.mode&0o077))))throw new OperationError('UNSAFE_PATH','Skill update inputs and backups must be owner-controlled directories with appropriate permissions.');
    if(dirname(current)===current)break;
  }
}
async function assertUpdateFresh(plan:SkillUpdatePlan) {
  await existingDirectory(plan.path);
  if(!sameFiles(await tree(plan.path),plan.before)||!sameFiles(await tree(join(plan.root,'skills',skillName)),plan.files))throw new OperationError('STALE_SKILL','The maintained or installed skill changed after planning. Preview the update again.');
  for(const path of plan.duplicatePaths)if(await present(path))throw new OperationError('SKILL_CONFLICT','Another same-name skill exists in a known discovery location. Resolve it before updating.');
}
async function recognizedInstallation(root:string,path:string,files:SkillFile[]) {
  const backups=join(root,'.local/install-backups');
  if(!await present(backups))return false;
  await existingDirectory(join(root,'.local'),true);await existingDirectory(backups,true);
  const names=await readdir(backups);
  if(names.length>256)throw new OperationError('SKILL_LIMIT','Too many installation receipts to inspect safely.');
  for(const name of names) {
    const directory=join(backups,name),info=await lstat(directory);
    if(!info.isDirectory()||info.isSymbolicLink())continue;
    await existingDirectory(directory,true);
    if(!await present(join(directory,'complete.json'))||!await present(join(directory,'receipt.json')))continue;
    let receipt,complete;
    try{receipt=JSON.parse((await read(join(directory,'receipt.json'))).bytes!.toString('utf8'));complete=JSON.parse((await read(join(directory,'complete.json'))).bytes!.toString('utf8'));}catch{continue;}
    const ownReceipt=(receipt.version===1&&receipt.scope==='global'&&receipt.skill?.created===true)||(receipt.version===2&&receipt.kind==='skill-update'&&receipt.scope==='global');
    if(ownReceipt&&receipt.skill?.path===path&&Array.isArray(complete.completed)&&complete.completed.includes(path)&&Array.isArray(receipt.skill.files)&&receipt.skill.files.length===files.length&&files.every((file,index)=>receipt.skill.files[index]?.path===file.relative&&receipt.skill.files[index]?.sha256===file.sha256))return true;
  }
  return false;
}
export async function planSkillUpdate(options:SkillUpdateOptions):Promise<SkillUpdatePlan> {
  const root=resolve(options.root),userHome=options.userHome??homedir();
  const codex=options.codexDirectory??process.env.CODEX_HOME??join(userHome,'.codex');
  const opencode=options.opencodeDirectory??join(process.env.XDG_CONFIG_HOME??join(userHome,'.config'),'opencode');
  if(![userHome,codex,opencode].every(isAbsolute))throw new OperationError('INVALID_PATH','Skill update paths must be absolute.');
  const path=join(userHome,'.agents/skills',skillName);
  if(!await present(path))throw new OperationError('SKILL_NOT_INSTALLED','The shared skill is absent. Use the initial harness installer first.');
  await existingDirectory(path);await existingDirectory(join(root,'skills',skillName));
  const before=await tree(path),files=await tree(join(root,'skills',skillName));
  if(!files.some(file=>file.relative==='SKILL.md'))throw new OperationError('INVALID_SKILL','Maintained skill is missing its instructions.');
  const plan={root,path,before,files,duplicatePaths:discoveryPaths(root,userHome,codex,opencode)};
  await assertUpdateFresh(plan);
  if(!sameFiles(before,files)&&!await recognizedInstallation(root,path,before))throw new OperationError('SKILL_CONFLICT','The installed skill does not match a completed installation receipt. User edits or an unknown installation were not overwritten.');
  return plan;
}
export function skillUpdateReport(plan:SkillUpdatePlan) {
  return {scope:'shared-skill-only',applied:false,path:plan.path,change:!sameFiles(plan.before,plan.files),files:plan.files.map(file=>({path:file.relative,sha256:file.sha256})),clientSettingsChanged:false,pairingChanged:false,clientLoadingVerified:false};
}
export async function applySkillUpdate(plan:SkillUpdatePlan) {
  await assertUpdateFresh(plan);
  if(sameFiles(plan.before,plan.files))return {...skillUpdateReport(plan),applied:true,changed:false,backupDirectory:null,previousDirectory:null};
  // Recheck provenance as well as bytes immediately before preparing writes.
  if(!await recognizedInstallation(plan.root,plan.path,plan.before))throw new OperationError('SKILL_CONFLICT','The completed installation receipt changed. Nothing was replaced.');
  await ownerDirectory(dirname(plan.path));
  const backups=join(plan.root,'.local/install-backups');await existingDirectory(backups,true);
  const retained=join(dirname(dirname(plan.path)),'aseprite-skill-updates');await ownerDirectory(retained);await existingDirectory(retained,true);
  if((await lstat(retained)).dev!==(await lstat(plan.path)).dev)throw new OperationError('UNSAFE_PATH','Skill staging and destination must be on the same filesystem.');
  const id=randomUUID(),backupDirectory=join(backups,id),staging=join(retained,id),next=join(staging,'next'),previousDirectory=join(staging,'before');
  await mkdir(backupDirectory,{mode:0o700});await mkdir(staging,{mode:0o700});await mkdir(next,{mode:0o700});
  let phase='preparing';
  try {
    const receipt={version:2,kind:'skill-update',scope:'global',createdAt:new Date().toISOString(),status:'prepared',previousDirectory,skill:{path:plan.path,files:plan.files.map(file=>({path:file.relative,sha256:file.sha256})),beforeFiles:plan.before.map(file=>({path:file.relative,sha256:file.sha256}))}};
    await writeNew(join(backupDirectory,'receipt.json'),Buffer.from(JSON.stringify(receipt,null,2)+'\n'));
    for(const file of plan.files){const path=join(next,file.relative);await ownerDirectory(dirname(path));await writeNew(path,file.bytes);}
    if(!sameFiles(await tree(next),plan.files))throw new OperationError('INSTALL_VERIFY_FAILED','The staged skill failed verification.');
    await assertUpdateFresh(plan);await existingDirectory(dirname(plan.path));await existingDirectory(staging,true);
    await rename(plan.path,previousDirectory);phase='previous-retained';
    // A two-rename directory swap is not atomic. Refuse a destination created
    // during the gap rather than intentionally replacing another installation.
    if(await present(plan.path))throw new OperationError('STALE_SKILL','Another skill appeared during the update.');
    await rename(next,plan.path);phase='new-installed';
    if(!sameFiles(await tree(plan.path),plan.files)||!sameFiles(await tree(previousDirectory),plan.before))throw new OperationError('INSTALL_VERIFY_FAILED','Updated or retained skill failed verification.');
    await writeNew(join(backupDirectory,'complete.json'),Buffer.from(JSON.stringify({completed:[plan.path],completedAt:new Date().toISOString()})+'\n'));
    return {...skillUpdateReport(plan),applied:true,changed:true,backupDirectory,previousDirectory};
  }catch {
    throw new OperationError('PARTIAL_SKILL_UPDATE',`Skill update stopped during ${phase}. Retained receipt: ${backupDirectory}; previous directory if moved: ${previousDirectory}; staged candidate if not promoted: ${next}. Inspect these exact paths before retrying; no automatic rollback or deletion was attempted.`);
  }
}
