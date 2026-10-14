import { resolve } from 'node:path';
import { packageExtension } from '../src/setup/package-extension.ts';
const root=resolve(import.meta.dir,'..');
try {
  const metadata=await Bun.file(resolve(root,'extension/package.json')).json();
  if(!/^\d+\.\d+\.\d+$/.test(metadata.version))throw new Error('Invalid extension package version');
  const path=await packageExtension(resolve(root,'extension'),resolve(root,`dist/aseprite-mcp-${metadata.version}.aseprite-extension`));
  console.error(`Packaged extension: ${path}. Install it through Aseprite Preferences > Extensions.`);
} catch(error) {console.error((error as NodeJS.ErrnoException).code==='EEXIST'?'Package already exists; it was not overwritten.':`Packaging failed: ${(error as Error).message}`);process.exitCode=1;}
