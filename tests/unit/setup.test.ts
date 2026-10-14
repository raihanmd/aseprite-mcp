import { expect, test } from 'bun:test';
import { chmod, mkdtemp, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareSetup, readConnection,prepareExecutable,readExecutable } from '../../src/setup/config.ts';
import { packageExtension } from '../../src/setup/package-extension.ts';

test('setup is private and idempotent, and client entries contain no pairing token',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-setup-'));
  try {
    const first=await prepareSetup(root,process.execPath);
    const config=await readConnection(first.path);
    expect(config.token).toHaveLength(64);
    expect((await stat(first.path)).mode&0o777).toBe(0o600);
    expect((await stat(join(root,'.local'))).mode&0o777).toBe(0o700);
    await prepareSetup(root,process.execPath);
    expect((await readConnection(first.path)).token).toBe(config.token);
    const codex=await Bun.file(join(root,'install/codex.toml')).text();
    const opencode=await Bun.file(join(root,'install/opencode.json')).text();
    expect(codex.includes(config.token)).toBe(false);expect(opencode.includes(config.token)).toBe(false);
    expect(JSON.parse(opencode).mcp.aseprite.command).toEqual([process.execPath,join(root,'scripts/launch.ts')]);
    await Bun.write(join(root,'install/codex.toml'),'user-edited configuration');
    await expect(prepareSetup(root,process.execPath)).rejects.toMatchObject({code:'CONFIG_EXISTS'});
    expect(await Bun.file(join(root,'install/codex.toml')).text()).toBe('user-edited configuration');
    await chmod(first.path,0o644);
    await expect(readConnection(first.path)).rejects.toMatchObject({code:'INSECURE_CONFIG'});
  } finally {await rm(root,{recursive:true,force:true});}
});
test('setup rejects symlinked local directory and invalid port before generating configuration',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-setup-link-'));
  const outside=await mkdtemp(join(tmpdir(),'aseprite-outside-'));
  try {
    await expect(prepareSetup(root,process.execPath,80)).rejects.toThrow();
    expect(await Bun.file(join(root,'.local/connection.json')).exists()).toBe(false);
    await symlink(outside,join(root,'.local'));
    await expect(prepareSetup(root,process.execPath)).rejects.toMatchObject({code:'INSECURE_CONFIG'});
    expect(await Bun.file(join(outside,'connection.json')).exists()).toBe(false);
  } finally {await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
test('extension package contains only the six required entries and never overwrites',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-package-'));
  const output=join(root,'test.aseprite-extension');
  try {
    await packageExtension(join(import.meta.dir,'../../extension'),output);
    const bytes=Buffer.from(await Bun.file(output).arrayBuffer());
    expect(bytes.readUInt32LE(0)).toBe(0x04034b50);
    const names:string[]=[];
    for(let i=0;i<bytes.length-46;i++) {
      if(bytes.readUInt32LE(i)!==0x02014b50)continue;
      const length=bytes.readUInt16LE(i+28);
      names.push(bytes.subarray(i+46,i+46+length).toString());
      i+=45+length+bytes.readUInt16LE(i+30)+bytes.readUInt16LE(i+32);
    }
    expect(names.sort()).toEqual(['art_operations.lua','codec.lua','compatibility.lua','main.lua','operations.lua','package.json']);
    await expect(packageExtension(join(import.meta.dir,'../../extension'),output)).rejects.toMatchObject({code:'EEXIST'});
    expect(Buffer.from(await Bun.file(output).arrayBuffer()).equals(bytes)).toBe(true);
  } finally {await rm(root,{recursive:true,force:true});}
});
test('local executable setup is private, idempotent and preserves pairing/client configuration',async()=>{
  const root=await mkdtemp(join(tmpdir(),'aseprite-executable-setup-'));
  try{
    await prepareSetup(root,process.execPath);const before=await readConnection(join(root,'.local/connection.json'));
    const client=await Bun.file(join(root,'install/codex.toml')).text();
    expect(await readExecutable(root)).toBeNull();
    await prepareExecutable(root,process.execPath);await prepareExecutable(root,process.execPath);
    expect(await readExecutable(root)).toBe(process.execPath);expect((await stat(join(root,'.local/executable.json'))).mode&0o777).toBe(0o600);
    expect(await readConnection(join(root,'.local/connection.json'))).toEqual(before);
    expect(await Bun.file(join(root,'install/codex.toml')).text()).toBe(client);
    await Bun.write(join(root,'.local/executable.json'),'user-edited');
    await expect(prepareExecutable(root,process.execPath)).rejects.toMatchObject({code:'CONFIG_EXISTS'});
    await expect(readExecutable(root)).rejects.toMatchObject({code:'INVALID_CONFIG'});
  }finally{await rm(root,{recursive:true,force:true});}
});
