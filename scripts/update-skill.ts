import {resolve} from 'node:path';
import {planSkillUpdate,skillUpdateReport,applySkillUpdate} from '../src/setup/harness.ts';
import {OperationError,failure} from '../src/core/errors.ts';
try {
  const args=process.argv.slice(2);
  if(args.some(arg=>arg!=='--apply')||args.length>1)throw new OperationError('INVALID_ARGUMENT','Use bun run update:skill to preview, or add --apply to update the recognized shared skill.');
  const plan=await planSkillUpdate({root:resolve(import.meta.dir,'..')});
  console.log(JSON.stringify(args.includes('--apply')?await applySkillUpdate(plan):skillUpdateReport(plan),null,2));
  console.error(args.includes('--apply')?'Shared art skill updated; client settings and pairing were not changed. Verify skill loading in a fresh client session.':'Preview only: no files changed. --apply requires write access to the shared skill directory.');
}catch(error){console.error(failure(error).error.message);process.exitCode=1;}
