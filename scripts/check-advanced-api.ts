import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { readExecutable } from '../src/setup/config.ts';

const root=resolve(import.meta.dir,'..');
const executable=process.env.ASEPRITE_MCP_EXECUTABLE??await readExecutable(root);
if(!executable||!isAbsolute(executable)) {
  console.error('Configure an absolute Aseprite executable with bun run setup --executable /path/to/aseprite.');
  process.exit(1);
}
const folder=await mkdtemp(join(tmpdir(),'aseprite-advanced-api-'));
const scripts=['tests/integration/animation-real.lua','tests/integration/components-real.lua','tests/fixtures/art_aseprite_smoke.lua'];
try {
  for(const script of scripts) {
    const child=Bun.spawn([executable,'--batch','--noinapp','--script-param',`outputPath=${join(folder,'component-roundtrip.aseprite')}`,'--script',resolve(root,script)],{
      cwd:root,
      env:{...process.env,ASEPRITE_USER_FOLDER:folder},
      stdin:'ignore',stdout:'pipe',stderr:'pipe',
    });
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;child.kill();},30000);
    const [stdout,stderr,exit]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]).finally(()=>clearTimeout(timer));
    if(stdout)process.stdout.write(stdout);
    if(stderr)process.stderr.write(stderr);
    if(timedOut||exit!==0)throw new Error(`${script} failed in real Aseprite (${timedOut?'timeout':`exit ${exit}`}).`);
  }
  console.log(JSON.stringify({ok:true,workflow:'real-aseprite-lua',scripts,executable,desktopConnectionTested:false}));
} catch(error) {
  console.error(error instanceof Error?error.message:String(error));
  process.exitCode=1;
} finally {await rm(folder,{recursive:true,force:true});}
