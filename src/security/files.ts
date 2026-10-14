import { constants } from 'node:fs';
import { mkdir, realpath, lstat, open, mkdtemp, rm, copyFile, link } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname, join, extname } from 'node:path';
import { OperationError } from '../core/errors.ts';

export class ProjectFiles {
  private constructor(readonly root: string) {}
  static async create(directory: string) { await mkdir(directory,{recursive:true,mode:0o700});return new ProjectFiles(await realpath(directory)); }
  async target(filename: string, extensions: string[]) {
    if (!filename || filename.includes('\0') || isAbsolute(filename)) throw new OperationError('INVALID_PATH','Use a relative filename inside the configured asset directory.');
    const path=resolve(this.root,filename), relation=relative(this.root,path);
    if (relation.startsWith('..')||isAbsolute(relation)||!extensions.includes(extname(path).toLowerCase())) throw new OperationError('INVALID_PATH','Filename escapes the asset directory or has an unsupported extension.');
    // Existing parents only: no implicit directory tree or symlink escapes.
    let parent:string;
    try {parent=await realpath(dirname(path));} catch {throw new OperationError('INVALID_PATH','Create the destination subdirectory before using it.');}
    const parentRelation=relative(this.root,parent);
    if (parentRelation.startsWith('..')||isAbsolute(parentRelation)) throw new OperationError('INVALID_PATH','A parent symlink escapes the asset directory.');
    try {await lstat(path);throw new OperationError('FILE_EXISTS','Destination already exists. Choose another filename; this release does not overwrite.');} catch(error) {if((error as NodeJS.ErrnoException).code!=='ENOENT') throw error;}
    return join(parent,filename.split(/[\\/]/).at(-1)!);
  }
  async write(filename: string, bytes: Uint8Array, extensions=['.png']) {
    const target=await this.target(filename,extensions);
    const file=await open(target,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try {await file.writeFile(bytes);await file.sync();} finally {await file.close();}
    return target;
  }
  async stage<T>(operation: (directory: string)=>Promise<T>):Promise<T> {
    const directory=await mkdtemp(join(this.root,'.aseprite-stage-'));
    try {return await operation(directory);} finally {await rm(directory,{recursive:true,force:true});}
  }
  async publish(stagingFile: string, filename: string, extensions=['.aseprite']) {
    const info=await lstat(stagingFile);
    if (!info.isFile()||info.size<128||info.size>64*1024*1024) throw new OperationError('INVALID_ARTIFACT','Editor did not produce a valid bounded source file.');
    const header=await Bun.file(stagingFile).slice(0,6).arrayBuffer();
    if (new DataView(header).getUint16(4,true)!==0xa5e0) throw new OperationError('INVALID_ARTIFACT','Source file is not an Aseprite document.');
    const target=await this.target(filename,extensions);
    await copyFile(stagingFile,target,constants.COPYFILE_EXCL);
    return target;
  }
  async publishReadyFile(stagingFile: string, filename: string, extensions: string[]) {
    const source=await realpath(stagingFile);
    const relation=relative(this.root,source);
    const info=await lstat(source);
    if(relation.startsWith('..')||isAbsolute(relation)||!info.isFile()||info.size<1||info.size>64*1024*1024)
      throw new OperationError('INVALID_ARTIFACT','Staged output must be a bounded regular file inside the asset directory.');
    const target=await this.target(filename,extensions);
    try {await link(source,target);}
    catch(error) {
      if((error as NodeJS.ErrnoException).code==='EEXIST') throw new OperationError('FILE_EXISTS','Destination already exists. Choose another filename; this release does not overwrite.');
      throw error;
    }
    return target;
  }
  async input(filename: string) {
    if (isAbsolute(filename)||filename.includes('\0')) throw new OperationError('INVALID_PATH','Use a relative input filename.');
    let path:string;
    try {path=await realpath(resolve(this.root,filename));} catch {throw new OperationError('FILE_MISSING','Input file does not exist.');}
    const rel=relative(this.root,path);
    if (rel.startsWith('..')||isAbsolute(rel)||!['.aseprite','.ase'].includes(extname(path).toLowerCase())) throw new OperationError('INVALID_PATH','Input must be an Aseprite file inside the asset directory.');
    const stat=await lstat(path);if(!stat.isFile()||stat.size>64*1024*1024) throw new OperationError('INVALID_PATH','Input must be a bounded regular file.');
    return path;
  }
}
