import { constants } from 'node:fs';
import { mkdir, mkdtemp, lstat, copyFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { OperationError } from '../core/errors.ts';

export async function packageExtension(extensionDirectory:string,output:string) {
  if(!output.endsWith('.aseprite-extension'))throw new OperationError('INVALID_PATH','Choose an .aseprite-extension output filename.');
  const entries=['package.json','main.lua','operations.lua','art_operations.lua','codec.lua','compatibility.lua'];
  for(const name of entries)if(!(await lstat(join(extensionDirectory,name))).isFile())throw new OperationError('INVALID_ARTIFACT','Extension sources must be regular files.');
  await mkdir(dirname(output),{recursive:true});
  const directory=await mkdtemp(join(dirname(output),'.extension-package-'));
  try {
    const archive=resolve(directory,'extension.zip');
    // Only these named sources enter the ZIP; no assets or pairing files.
    const child=Bun.spawn(['zip','-q','-X',archive,...entries],{cwd:extensionDirectory,stdin:'ignore',stdout:'inherit',stderr:'inherit'});
    if(await child.exited!==0)throw new OperationError('PACKAGE_FAILED','zip failed to package the extension.');
    await copyFile(archive,output,constants.COPYFILE_EXCL);
    return output;
  } finally {await rm(directory,{recursive:true,force:true});}
}
