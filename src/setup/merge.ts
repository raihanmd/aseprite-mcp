import {isDeepStrictEqual} from 'node:util';
import {OperationError} from '../core/errors.ts';

const object=(value:unknown):value is Record<string,any>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function parse(text:string,format:'toml'|'jsonc') {
  try {
    const value=format==='toml'?Bun.TOML.parse(text):Bun.JSONC.parse(text);
    if(!object(value))throw new Error();
    return value;
  }catch {throw new OperationError('INVALID_CONFIG','Client configuration is invalid. Its contents were not logged or changed.');}
}
function existing(config:Record<string,any>,key:string,entry:Record<string,any>) {
  if(Object.hasOwn(config,key)&&!object(config[key]))throw new OperationError('CONFIG_CONFLICT','The MCP settings are not an object/table. Nothing was changed.');
  if(config[key]&&Object.hasOwn(config[key],'aseprite')) {
    if(!isDeepStrictEqual(config[key].aseprite,entry))throw new OperationError('CONFIG_CONFLICT','An Aseprite entry already exists with different settings. It was not overwritten.');
    return true;
  }
  return false;
}
function verify(before:Record<string,any>,after:Record<string,any>,key:string,entry:Record<string,any>) {
  const expected=structuredClone(before);expected[key]={...(expected[key]??{}),aseprite:entry};
  if(!isDeepStrictEqual(expected,after))throw new OperationError('MERGE_FAILED','The proposed merge would change unrelated settings. Nothing was changed.');
}
export function mergeCodex(text:string,command:string[]) {
  const entry={command:command[0],args:command.slice(1)};
  const before=parse(text,'toml');if(existing(before,'mcp_servers',entry))return text;
  const addition=`\n\n# Aseprite MCP\n[mcp_servers.aseprite]\ncommand = ${JSON.stringify(entry.command)}\nargs = ${JSON.stringify(entry.args)}\n`;
  const merged=text+addition;verify(before,parse(merged,'toml'),'mcp_servers',entry);return merged;
}

type Token={value:string;start:number;end:number;string?:string};
// Locate insertion points without reserializing comments, formatting, credentials,
// or unrelated keys. Bun's parser validates the complete document first/afterward.
function tokens(text:string):Token[] {
  const result:Token[]=[];let i=0;
  while(i<text.length) {
    if(/\s/.test(text[i]!)){i++;continue;}
    if(text.startsWith('//',i)){while(i<text.length&&text[i]!=='\n')i++;continue;}
    if(text.startsWith('/*',i)){const end=text.indexOf('*/',i+2);if(end<0)throw new OperationError('INVALID_CONFIG','Unclosed configuration comment.');i=end+2;continue;}
    const start=i;
    if(text[i]==='"') {
      i++;while(i<text.length){if(text[i]==='\\'){i+=2;continue;}if(text[i++]==='"')break;}
      const value=text.slice(start,i);result.push({value,start,end:i,string:JSON.parse(value)});continue;
    }
    if('{}[],:'.includes(text[i]!)){result.push({value:text[i++]!,start,end:i});continue;}
    while(i<text.length&&!/[\s{}\[\],:]/.test(text[i]!)&&!text.startsWith('//',i)&&!text.startsWith('/*',i))i++;
    result.push({value:text.slice(start,i),start,end:i});
  }
  return result;
}
export function mergeOpenCode(text:string,command:string[]) {
  const entry={type:'local',command,enabled:true};
  const before=parse(text,'jsonc');if(existing(before,'mcp',entry))return text;
  const scanned=tokens(text);let depth=0,mcpStart=-1,mcpClose=-1,rootClose=-1,mcpKeys=0;
  for(let i=0;i<scanned.length;i++) {
    const token=scanned[i]!;
    if(depth===1&&token.string==='mcp'&&scanned[i+1]?.value===':') {
      mcpKeys++;if(scanned[i+2]?.value==='{')mcpStart=i+2;
    }
    if(token.value==='{')depth++;
    else if(token.value==='}') {
      if(depth===2&&mcpStart>=0&&mcpClose<0)mcpClose=i;
      if(depth===1)rootClose=i;
      depth--;
    } else if(token.value==='[')depth++;
    else if(token.value===']')depth--;
  }
  if(mcpKeys>1||rootClose<0||mcpKeys===1&&mcpClose<0)throw new OperationError('CONFIG_CONFLICT','Ambiguous MCP configuration. Nothing was changed.');
  const end=mcpClose>=0?mcpClose:rootClose;
  const nonempty=mcpClose>=0?Object.keys(before.mcp).length>0:Object.keys(before).length>0;
  const comma=nonempty&&scanned[end-1]?.value!==','?',':'';
  const key=mcpClose>=0?'aseprite':'mcp';const value=mcpClose>=0?entry:{aseprite:entry};
  const offset=scanned[end]!.start;
  const addition=`${comma}\n  ${JSON.stringify(key)}: ${JSON.stringify(value,null,2).replace(/\n/g,'\n  ')}\n`;
  const merged=text.slice(0,offset)+addition+text.slice(offset);
  verify(before,parse(merged,'jsonc'),'mcp',entry);return merged;
}
