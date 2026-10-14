import {expect,test,spyOn} from 'bun:test';
import * as fs from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {planHarness,applyHarness,installationReport,planSkillUpdate,applySkillUpdate,skillUpdateReport} from '../../src/setup/harness.ts';
import {mergeCodex,mergeOpenCode} from '../../src/setup/merge.ts';

const command=[process.execPath,'/project/scripts/launch.ts'];
const parseCodex=(text:string)=>Bun.TOML.parse(text) as Record<string,any>;
const parseOpenCode=(text:string)=>Bun.JSONC.parse(text) as Record<string,any>;
const codex='# retain this comment\nmodel = "existing-model"\n[permissions]\nmode = "unchanged"\n[mcp_servers.other]\ncommand = "other-server"\n';
const opencode='{// retain this comment\n"provider":{"test":{"options":{"apiKey":"fake-test-secret"}}},"agent":{"build":{"tools":{"other_*":true}}},"permission":{"skill":"ask"},"mcp":{"other":{"type":"local","command":["other-server"]},},}\n';

async function fixture(run:(paths:{base:string;root:string;userHome:string;codexDirectory:string;opencodeDirectory:string})=>Promise<void>) {
  const base=await fs.mkdtemp(join(tmpdir(),'aseprite-harness-'));
  const root=join(base,'project'),userHome=join(base,'home'),codexDirectory=join(userHome,'.codex'),opencodeDirectory=join(userHome,'.config/opencode');
  try {
    for(const directory of [join(root,'.local'),join(root,'scripts'),join(root,'skills/aseprite-pixel-art/references'),codexDirectory,opencodeDirectory])await fs.mkdir(directory,{recursive:true,mode:0o700});
    await fs.writeFile(join(root,'.local/connection.json'),'private setup fixture',{mode:0o600});
    await fs.writeFile(join(root,'scripts/launch.ts'),'// launch fixture');
    await fs.writeFile(join(root,'skills/aseprite-pixel-art/SKILL.md'),'---\nname: aseprite-pixel-art\ndescription: Test fixture\n---\n');
    await fs.writeFile(join(root,'skills/aseprite-pixel-art/references/craft.md'),'craft reference');
    await fs.writeFile(join(codexDirectory,'config.toml'),codex,{mode:0o640});
    await fs.writeFile(join(opencodeDirectory,'opencode.json'),opencode,{mode:0o600});
    await run({base,root,userHome,codexDirectory,opencodeDirectory});
  } finally {await fs.rm(base,{recursive:true,force:true});}
}

test('merges preserve unrelated effective settings, comments and credentials and are idempotent',()=>{
  const mergedCodex=mergeCodex(codex,command),mergedOpenCode=mergeOpenCode(opencode,command);
  expect(mergedCodex.startsWith(codex)).toBe(true);
  expect(mergedOpenCode).toContain('// retain this comment');
  expect(mergedOpenCode).toContain('"apiKey":"fake-test-secret"');
  const c=parseCodex(mergedCodex),o=parseOpenCode(mergedOpenCode);
  delete c.mcp_servers.aseprite;delete o.mcp.aseprite;
  expect(c).toEqual(parseCodex(codex));expect(o).toEqual(parseOpenCode(opencode));
  expect(mergeCodex(mergedCodex,command)).toBe(mergedCodex);
  expect(mergeOpenCode(mergedOpenCode,command)).toBe(mergedOpenCode);
});

test.each(['{}','{ /* comment */ }','{"model":"keep"}','{"mcp":{}}','{"mcp":{"other":{"command":["}","mcp"]}}}', '{"mcp":{},"tail":{"nested":[]},}'])('OpenCode insertion handles empty, nested and trailing-comma settings: %s',text=>{
  const merged=parseOpenCode(mergeOpenCode(text,command)),before=parseOpenCode(text);
  expect(merged.mcp.aseprite).toEqual({type:'local',command,enabled:true});
  delete merged.mcp.aseprite;
  if(!before.mcp)delete merged.mcp;
  expect(merged).toEqual(before);
});

test('invalid, ambiguous and conflicting configurations are refused',()=>{
  for(const text of ['{bad','{"mcp":[]}','{"mcp":null}','{"mcp":{},"mcp":{}}','{"mcp":{"aseprite":{"enabled":false}}}'])expect(()=>mergeOpenCode(text,command)).toThrow();
  for(const text of ['broken toml','mcp_servers = []','[mcp_servers.aseprite]\ncommand="custom"'])expect(()=>mergeCodex(text,command)).toThrow();
});

test('preview is read-only; application backs up exact bytes, preserves modes, copies references and repeats without writes',async()=>fixture(async paths=>{
  const options={...paths,bunPath:process.execPath},plan=await planHarness(options);
  expect(installationReport(plan).applied).toBe(false);
  expect(await Bun.file(join(paths.codexDirectory,'config.toml')).text()).toBe(codex);
  expect(await Bun.file(join(paths.opencodeDirectory,'opencode.json')).text()).toBe(opencode);
  expect(await Bun.file(join(paths.root,'.local/install-backups')).exists()).toBe(false);
  const result=await applyHarness(plan);
  expect(result.applied).toBe(true);expect(result.backupDirectory).toBeTruthy();
  const backup=result.backupDirectory!;
  expect(await Bun.file(join(backup,'codex.before')).text()).toBe(codex);
  expect(await Bun.file(join(backup,'opencode.before')).text()).toBe(opencode);
  expect((await fs.stat(backup)).mode&0o777).toBe(0o700);
  expect((await fs.stat(join(backup,'codex.before'))).mode&0o777).toBe(0o600);
  expect((await fs.stat(join(paths.codexDirectory,'config.toml'))).mode&0o777).toBe(0o640);
  expect(await Bun.file(join(plan.skill.path,'references/craft.md')).text()).toBe('craft reference');
  expect(await Bun.file(join(backup,'complete.json')).exists()).toBe(true);
  const before=(await fs.stat(join(paths.codexDirectory,'config.toml'))).mtimeMs;
  const repeated=await applyHarness(await planHarness(options));
  expect(repeated.changed).toBe(false);expect(repeated.backupDirectory).toBeNull();
  expect((await fs.stat(join(paths.codexDirectory,'config.toml'))).mtimeMs).toBe(before);
}));

test('missing configs and JSONC destinations are supported without creating a competing JSON file',async()=>fixture(async paths=>{
  await fs.unlink(join(paths.codexDirectory,'config.toml'));
  await fs.rename(join(paths.opencodeDirectory,'opencode.json'),join(paths.opencodeDirectory,'opencode.jsonc'));
  const plan=await planHarness({...paths,bunPath:process.execPath});
  const result=await applyHarness(plan);
  const receipt=await Bun.file(join(result.backupDirectory!,'receipt.json')).json();
  expect(receipt.configs.find((item:any)=>item.client==='codex').backup).toBeNull();
  expect(await Bun.file(join(paths.opencodeDirectory,'opencode.json')).exists()).toBe(false);
  expect(parseOpenCode(await Bun.file(join(paths.opencodeDirectory,'opencode.jsonc')).text()).mcp.aseprite.enabled).toBe(true);
}));

test('stale settings or newly installed skills are refused before client writes',async()=>fixture(async paths=>{
  const plan=await planHarness({...paths,bunPath:process.execPath});
  await fs.appendFile(join(paths.codexDirectory,'config.toml'),'\n# concurrent change\n');
  await expect(applyHarness(plan)).rejects.toMatchObject({code:'STALE_CONFIG'});
  expect(await Bun.file(join(paths.opencodeDirectory,'opencode.json')).text()).toBe(opencode);
  const next=await planHarness({...paths,bunPath:process.execPath});
  await fs.mkdir(next.skill.path,{recursive:true});
  await expect(applyHarness(next)).rejects.toMatchObject({code:'STALE_SKILL'});
}));

test('conflicting skills, duplicate discovery copies, competing configs and symlinked targets are refused',async()=>fixture(async paths=>{
  const options={...paths,bunPath:process.execPath};
  const plan=await planHarness(options);
  await fs.mkdir(plan.skill.path,{recursive:true});
  await fs.writeFile(join(plan.skill.path,'SKILL.md'),'user skill');
  await expect(planHarness(options)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  await fs.rm(plan.skill.path,{recursive:true});
  const duplicate=join(paths.codexDirectory,'skills/aseprite-pixel-art');
  await fs.mkdir(duplicate,{recursive:true});
  await expect(planHarness(options)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  await fs.rm(duplicate,{recursive:true});
  await fs.writeFile(join(paths.opencodeDirectory,'opencode.jsonc'),'{}');
  await expect(planHarness(options)).rejects.toMatchObject({code:'CONFIG_CONFLICT'});
  await fs.unlink(join(paths.opencodeDirectory,'opencode.jsonc'));
  await fs.rename(join(paths.codexDirectory,'config.toml'),join(paths.base,'outside.toml'));
  await fs.symlink(join(paths.base,'outside.toml'),join(paths.codexDirectory,'config.toml'));
  await expect(planHarness(options)).rejects.toMatchObject({code:'CONFIG_ACCESS'});
  expect(await Bun.file(join(paths.base,'outside.toml')).text()).toBe(codex);
}));

test('insecure setup and writable target parents are refused without changing settings',async()=>fixture(async paths=>{
  const options={...paths,bunPath:process.execPath};
  await fs.chmod(join(paths.root,'.local/connection.json'),0o644);
  await expect(planHarness(options)).rejects.toMatchObject({code:'INSECURE_CONFIG'});
  await fs.chmod(join(paths.root,'.local/connection.json'),0o600);
  const plan=await planHarness(options);
  await fs.chmod(paths.opencodeDirectory,0o777);
  await expect(applyHarness(plan)).rejects.toMatchObject({code:'UNSAFE_PATH'});
  expect(await Bun.file(join(paths.codexDirectory,'config.toml')).text()).toBe(codex);
}));

test('a second config write failure retains backups and reports the precise partial installation',async()=>fixture(async paths=>{
  const plan=await planHarness({...paths,bunPath:process.execPath});
  const rename=fs.rename;
  const mock=spyOn(fs,'rename').mockImplementation(async(from,to)=>{
    if(to===join(paths.opencodeDirectory,'opencode.json'))throw new Error('injected write failure');
    return rename(from,to);
  });
  try {await expect(applyHarness(plan)).rejects.toMatchObject({code:'PARTIAL_INSTALL'});}
  finally {mock.mockRestore();}
  expect(parseCodex(await Bun.file(join(paths.codexDirectory,'config.toml')).text()).mcp_servers.aseprite).toBeTruthy();
  expect(await Bun.file(join(paths.opencodeDirectory,'opencode.json')).text()).toBe(opencode);
  const backups=join(paths.root,'.local/install-backups'),[id]=await fs.readdir(backups);
  expect(await Bun.file(join(backups,id!,'codex.before')).text()).toBe(codex);
  expect(await Bun.file(join(backups,id!,'opencode.before')).text()).toBe(opencode);
  expect(await Bun.file(join(backups,id!,'receipt.json')).exists()).toBe(true);
  expect(await Bun.file(join(backups,id!,'complete.json')).exists()).toBe(false);
  expect((await fs.readdir(paths.opencodeDirectory)).some(name=>name.endsWith('.tmp'))).toBe(false);
}));

async function installedFixture(run:(paths:Parameters<Parameters<typeof fixture>[0]>[0],skillPath:string,receiptDirectory:string)=>Promise<void>) {
  await fixture(async paths=>{
    const plan=await planHarness({...paths,bunPath:process.execPath});
    const installed=await applyHarness(plan);
    await run(paths,plan.skill.path,installed.backupDirectory!);
  });
}
async function changeCandidate(root:string) {
  await fs.appendFile(join(root,'skills/aseprite-pixel-art/SKILL.md'),'\nUpdated drawing guidance.\n');
  await fs.writeFile(join(root,'skills/aseprite-pixel-art/references/poses.md'),'New pose guidance.');
}

test('skill-only preview is read-only; update retains old bytes outside discovery and changes no settings or pairing',async()=>installedFixture(async(paths,skillPath,receiptDirectory)=>{
  const beforeSkill=await Bun.file(join(skillPath,'SKILL.md')).text();
  const beforeCodex=await Bun.file(join(paths.codexDirectory,'config.toml')).text();
  const beforeOpenCode=await Bun.file(join(paths.opencodeDirectory,'opencode.json')).text();
  const beforePairing=await Bun.file(join(paths.root,'.local/connection.json')).text();
  await changeCandidate(paths.root);
  const plan=await planSkillUpdate(paths),report=skillUpdateReport(plan);
  expect(report.change).toBe(true);expect(report.applied).toBe(false);
  expect(await fs.readdir(join(paths.root,'.local/install-backups'))).toEqual([receiptDirectory.split('/').at(-1)!]);
  expect(await Bun.file(join(skillPath,'SKILL.md')).text()).toBe(beforeSkill);
  expect(await Bun.file(join(paths.userHome,'.agents/aseprite-skill-updates')).exists()).toBe(false);
  const applied=await applySkillUpdate(plan);
  expect(applied.changed).toBe(true);
  expect(applied.previousDirectory!.startsWith(join(paths.userHome,'.agents/aseprite-skill-updates/'))).toBe(true);
  expect(await Bun.file(join(applied.previousDirectory!,'SKILL.md')).text()).toBe(beforeSkill);
  expect(await Bun.file(join(applied.previousDirectory!,'references/craft.md')).text()).toBe('craft reference');
  expect(await Bun.file(join(skillPath,'references/poses.md')).text()).toBe('New pose guidance.');
  expect((await fs.stat(applied.previousDirectory!)).mode&0o777).toBe(0o700);
  expect((await fs.stat(applied.backupDirectory!)).mode&0o777).toBe(0o700);
  expect(await Bun.file(join(applied.backupDirectory!,'complete.json')).exists()).toBe(true);
  expect(await Bun.file(join(paths.codexDirectory,'config.toml')).text()).toBe(beforeCodex);
  expect(await Bun.file(join(paths.opencodeDirectory,'opencode.json')).text()).toBe(beforeOpenCode);
  expect(await Bun.file(join(paths.root,'.local/connection.json')).text()).toBe(beforePairing);
  const mtime=(await fs.stat(join(skillPath,'SKILL.md'))).mtimeMs;
  const repeated=await applySkillUpdate(await planSkillUpdate(paths));
  expect(repeated.changed).toBe(false);expect(repeated.backupDirectory).toBeNull();
  expect((await fs.stat(join(skillPath,'SKILL.md'))).mtimeMs).toBe(mtime);
}));

test('a later skill-only receipt authorizes the next update, including removal of a maintained reference',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  const first=await applySkillUpdate(await planSkillUpdate(paths));
  await fs.unlink(join(paths.root,'skills/aseprite-pixel-art/references/craft.md'));
  await fs.appendFile(join(paths.root,'skills/aseprite-pixel-art/references/poses.md'),'\nSecond revision.');
  const second=await applySkillUpdate(await planSkillUpdate(paths));
  expect(second.changed).toBe(true);
  expect(await Bun.file(join(skillPath,'references/craft.md')).exists()).toBe(false);
  expect(await Bun.file(join(second.previousDirectory!,'references/craft.md')).text()).toBe('craft reference');
  expect(await Bun.file(join(first.previousDirectory!,'SKILL.md')).exists()).toBe(true);
}));

test('customized installed files and additions are not overwritten by a skill update',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  await fs.appendFile(join(skillPath,'references/craft.md'),'\nUser edits.');
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  expect(await Bun.file(join(skillPath,'references/craft.md')).text()).toContain('User edits.');
  await fs.writeFile(join(skillPath,'references/craft.md'),'craft reference');
  await fs.writeFile(join(skillPath,'user-notes.md'),'Keep this.');
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  expect(await Bun.file(join(skillPath,'user-notes.md')).text()).toBe('Keep this.');
}));

test('unknown, incomplete, or symlinked receipts do not authorize replacement',async()=>installedFixture(async(paths,skillPath,receiptDirectory)=>{
  await changeCandidate(paths.root);
  const complete=await Bun.file(join(receiptDirectory,'complete.json')).text();
  await fs.unlink(join(receiptDirectory,'complete.json'));
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  await fs.writeFile(join(receiptDirectory,'complete.json'),complete);
  await fs.rename(join(receiptDirectory,'receipt.json'),join(paths.base,'outside-receipt.json'));
  await fs.symlink(join(paths.base,'outside-receipt.json'),join(receiptDirectory,'receipt.json'));
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  expect(await Bun.file(join(skillPath,'references/craft.md')).text()).toBe('craft reference');
}));

test('skill update rechecks both source and destination and refuses new duplicate discovery copies',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  const installedPlan=await planSkillUpdate(paths);
  await fs.appendFile(join(skillPath,'references/craft.md'),'\nConcurrent user edit.');
  await expect(applySkillUpdate(installedPlan)).rejects.toMatchObject({code:'STALE_SKILL'});
  await fs.writeFile(join(skillPath,'references/craft.md'),'craft reference');
  const sourcePlan=await planSkillUpdate(paths);
  await fs.appendFile(join(paths.root,'skills/aseprite-pixel-art/references/poses.md'),'\nConcurrent source edit.');
  await expect(applySkillUpdate(sourcePlan)).rejects.toMatchObject({code:'STALE_SKILL'});
  const duplicatePlan=await planSkillUpdate(paths);
  await fs.mkdir(join(paths.codexDirectory,'skills/aseprite-pixel-art'),{recursive:true});
  await expect(applySkillUpdate(duplicatePlan)).rejects.toMatchObject({code:'SKILL_CONFLICT'});
  expect(await Bun.file(join(skillPath,'references/poses.md')).exists()).toBe(false);
}));

test('missing skill, symlinked directory ancestors and unsafe writable parents are refused',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  const plan=await planSkillUpdate(paths);
  await fs.chmod(join(paths.userHome,'.agents/skills'),0o777);
  await expect(applySkillUpdate(plan)).rejects.toMatchObject({code:'UNSAFE_PATH'});
  await fs.chmod(join(paths.userHome,'.agents/skills'),0o700);
  await fs.rename(join(paths.userHome,'.agents'),join(paths.base,'outside-agents'));
  await fs.symlink(join(paths.base,'outside-agents'),join(paths.userHome,'.agents'));
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'UNSAFE_PATH'});
  await fs.unlink(join(paths.userHome,'.agents'));
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'SKILL_NOT_INSTALLED'});
  expect(await Bun.file(join(paths.base,'outside-agents/skills/aseprite-pixel-art/references/craft.md')).text()).toBe('craft reference');
}));

test('promotion failure retains the previous skill and precise recovery paths without touching configs',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  const plan=await planSkillUpdate(paths);
  const settings=await Bun.file(join(paths.codexDirectory,'config.toml')).text();
  const rename=fs.rename,mock=spyOn(fs,'rename').mockImplementation(async(from,to)=>{
    if(to===skillPath)throw new Error('injected promotion failure');
    return rename(from,to);
  });
  let error:any;
  try{await applySkillUpdate(plan);}catch(caught){error=caught;}finally{mock.mockRestore();}
  expect(error.code).toBe('PARTIAL_SKILL_UPDATE');expect(error.message).toContain('previous-retained');
  const retained=join(paths.userHome,'.agents/aseprite-skill-updates'),[id]=await fs.readdir(retained);
  expect(await Bun.file(join(retained,id!,'before/references/craft.md')).text()).toBe('craft reference');
  expect(await Bun.file(join(retained,id!,'next/references/poses.md')).text()).toBe('New pose guidance.');
  expect(await Bun.file(join(paths.root,'.local/install-backups',id!,'complete.json')).exists()).toBe(false);
  expect(await Bun.file(join(skillPath,'SKILL.md')).exists()).toBe(false);
  expect(await Bun.file(join(paths.codexDirectory,'config.toml')).text()).toBe(settings);
}));

test('a non-regular skill input is rejected without blocking or changing the installation',async()=>installedFixture(async(paths,skillPath)=>{
  await changeCandidate(paths.root);
  const pipe=join(skillPath,'user-pipe');
  const created=Bun.spawnSync(['mkfifo',pipe]);
  expect(created.exitCode).toBe(0);
  await expect(planSkillUpdate(paths)).rejects.toMatchObject({code:'CONFIG_ACCESS'});
  expect(await Bun.file(join(skillPath,'references/craft.md')).text()).toBe('craft reference');
}));
