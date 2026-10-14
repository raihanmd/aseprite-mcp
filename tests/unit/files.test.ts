import { afterEach,expect,test } from 'bun:test';
import { mkdtemp,rm,mkdir,symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ProjectFiles } from '../../src/security/files.ts';
const directories:string[]=[];
afterEach(async()=>{for(const d of directories.splice(0))await rm(d,{recursive:true,force:true});});
async function setup(){const directory=await mkdtemp(join(tmpdir(),'aseprite-files-test-'));directories.push(directory);return {directory,files:await ProjectFiles.create(join(directory,'assets'))};}
test('exports use exclusive creation and never overwrite existing files',async()=>{
  const {files}=await setup();const path=await files.write('icon.png',Buffer.from('first'));
  await expect(files.write('icon.png',Buffer.from('second'))).rejects.toThrow();expect(await Bun.file(path).text()).toBe('first');
});
test('reject traversal, unsupported suffixes, absolute paths and symlink escapes',async()=>{
  const {directory,files}=await setup();await mkdir(join(directory,'elsewhere'));await symlink(join(directory,'elsewhere'),join(files.root,'link'));
  for(const path of ['../outside.png','/tmp/outside.png','icon.jpg','link/outside.png']) await expect(files.target(path,['.png'])).rejects.toMatchObject({code:'INVALID_PATH'});
});
test('temporary staging is private and removed after failure',async()=>{
  const {files}=await setup();let staging='';await expect(files.stage(async d=>{staging=d;throw new Error('fail');})).rejects.toThrow('fail');expect(await Bun.file(join(staging,'x')).exists()).toBe(false);
});
