import {resolve} from 'node:path';
import {planHarness,installationReport,applyHarness} from '../src/setup/harness.ts';
import {OperationError,failure} from '../src/core/errors.ts';
try {
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--apply')||args.length>1)throw new OperationError('INVALID_ARGUMENT','Use bun run install:harness to preview global installation, or add --apply to install.');
  if(process.env.OPENCODE_CONFIG||process.env.OPENCODE_CONFIG_DIR||process.env.OPENCODE_CONFIG_CONTENT)throw new OperationError('CUSTOM_CONFIG','An OpenCode configuration override is active. Resolve the intended global configuration before using this installer.');
  const plan=await planHarness({root:resolve(import.meta.dir,'..'),bunPath:process.execPath});
  console.log(JSON.stringify(args.includes('--apply')?await applyHarness(plan):installationReport(plan),null,2));
  console.error(args.includes('--apply')?'Configuration and shared skill installed. Fresh client sessions and editor pairing/acceptance are still required.':'Preview only: no files changed. --apply requires write access to the listed global paths.');
}catch(error){console.error(failure(error).error.message);process.exitCode=1;}
