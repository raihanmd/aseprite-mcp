import { resolve } from 'node:path';
import { prepareSetup,prepareExecutable } from '../src/setup/config.ts';
import { failure } from '../src/core/errors.ts';
const root=resolve(import.meta.dir,'..');
try {
  const args=process.argv.slice(2);
  if(args.length&&!(args.length===2&&args[0]==='--executable'))throw new Error('Expected --executable followed by an absolute path.');
  const result=await prepareSetup(root,process.execPath,Number(process.env.ASEPRITE_MCP_PORT??32123));
  if(args.length)console.error(`File-job executable configured: ${await prepareExecutable(root,args[1]!)}`);
  console.error(`Local setup prepared. Pairing port: ${result.port}.`);
  console.error(`Private pairing file: ${result.path} (token is not printed).`);
  console.error(`Client entries: ${result.clientEntries}. These are NOT installed client settings.`);
  console.error('Run bun run pairing-token privately to copy the token into the editor extension.');
} catch(error) {console.error(failure(error).error.message);process.exitCode=1;}
