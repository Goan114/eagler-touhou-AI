import {spawn} from 'node:child_process';
import {access,mkdir,cp,copyFile,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=name=>process.argv.find(value=>value.startsWith(`--${name}=`))?.slice(name.length+3);
const source=path.resolve(arg('source')??path.join(root,'build/netplay-upstream'));
const sdk=arg('emsdk')??process.env.EMSDK;
if(!sdk)throw Error('Required: --emsdk=/path/to/emsdk');
const unicode=arg('unifont')??process.env.EAGLER_DEVELOPMENT_UNICODE_FONT;
if(unicode)await access(unicode);
const build=path.join(root,'build/th06-online'),stage=path.join(build,'source');
const binary=path.join(build,'web'),temp=path.join(build,'tmp');
const extension=path.join(root,'build/browser-extension');
const deps=path.join(root,'build/deps');
for(const folder of [stage,binary,temp,extension])await mkdir(folder,{recursive:true});
const env={...process.env,EM_CONFIG:path.join(sdk,'.emscripten'),EMCC_TEMP_DIR:temp,TEMP:temp,TMP:temp,TMPDIR:temp};
const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd:root,env,stdio:'inherit',shell:false});
  child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error(`${command} exited ${code}`)));
});
await access(path.join(source,'ports/th06/src/netplay/Th06LanStageProbe.cpp'));
await cp(path.join(source,'ports/th06'),stage,{recursive:true,filter:entry=>
  !path.relative(path.join(source,'ports/th06'),entry).split(path.sep)
    .some(part=>['.git','build','assets','assets-ogg','vendored','tests','audit'].includes(part))});
for(const name of ['SDL','SDL_image','SDL_ttf']){
  await access(path.join(deps,name,'CMakeLists.txt')).catch(()=>{throw Error('Prepare SDL dependencies using build:th06 first');});
  await cp(path.join(deps,name),path.join(stage,'vendored',name),{recursive:true});
}
await cp(path.join(deps,'freetype'),path.join(stage,'vendored/SDL_ttf/external/freetype'),{recursive:true});
for(const name of ['AvoidanceHook.cpp','AvoidanceHook.hpp','NetplayHook.cpp','NetplayHook.hpp'])
  await copyFile(path.join(root,'integrations/th06',name),path.join(stage,'src',name));
const driver=path.join(stage,'src/netplay/Th06LanStageProbe.cpp');
let driverCode=(await readFile(driver,'utf8')).replaceAll('\r\n','\n');
const seam='    input.touchBomb = Touch::UsedTouchToBomb();';
if(driverCode.split(seam).length!==2)throw Error('Network capture seam changed; inspect the upstream owner');
driverCode='#include "../NetplayHook.hpp"\n'+driverCode.replace(seam,
  seam+'\n    Th06Ai::captureNetplay(input,g_LocalPlayer,frame,g_SessionGeneration);');
await writeFile(driver,driverCode);
const cmakeFile=path.join(stage,'CMakeLists.txt');
await writeFile(cmakeFile,(await readFile(cmakeFile,'utf8'))+`
# Client-only AI input producer; native gameplay and wire ABI are unchanged.
add_subdirectory("${root.replaceAll('\\','/')}" ai-core)
target_sources(th06 PRIVATE src/NetplayHook.cpp)
target_link_libraries(th06 PRIVATE eagler::ai)
`);
const cmake=arg('cmake')??'cmake';
await run(cmake,['-S',stage,'-B',binary,'-G','Ninja',
  `-DCMAKE_MAKE_PROGRAM=${arg('ninja')??'ninja'}`,
  `-DCMAKE_TOOLCHAIN_FILE=${path.join(sdk,'upstream/emscripten/cmake/Modules/Platform/Emscripten.cmake')}`,
  `-DEAGLER_COMMON_ROOT=${path.join(source,'common')}`,
  '-DCMAKE_BUILD_TYPE=Release','-DTH_ENABLE_NETPLAY=ON','-DTH_ENABLE_MULTIPLAYER_GAMEPLAY=ON',
  '-DTH_EXTERNAL_ASSETS=ON','-DTH_WEB_SHARED_FONT=ON','-DTH_WEB_MUSIC=BASE',
  '-DTH_ENABLE_THPRAC=OFF',`-DTH_ENABLE_THCRAP=${unicode?'ON':'OFF'}`,
  ...(unicode?[`-DTH_UNIFONT_FILE=${path.resolve(unicode)}`]:[]),
  '-DSDL_TESTS=OFF','-DSDL_TEST_LIBRARY=OFF','-DSDLIMAGE_SAMPLES=OFF','-DSDLIMAGE_TESTS=OFF',
  '-DSDLTTF_SAMPLES=OFF','-DSDLTTF_TESTS=OFF','-DSDLTTF_PLUTOSVG=OFF']);
await run(cmake,['--build',binary,'--target','th06','--parallel',arg('jobs')??'6']);
await cp(path.join(root,'integrations/browser-extension'),extension,{recursive:true});
await mkdir(path.join(extension,'runtime'),{recursive:true});
for(const file of ['th06.js','th06.wasm'])await copyFile(path.join(binary,file),path.join(extension,'runtime',file));
// The shell keeps the host's real epoch, resources, room and storage protocol.
// Execute its bootstrap as an extension MAIN-world file, without inline eval.
const shell=await readFile(path.join(stage,'resources/shell.html'),'utf8');
const scripts=[...shell.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if(scripts.length!==2||!shell.includes('eagler-runtime-script-template'))throw Error('Runtime shell layout changed');
await writeFile(path.join(extension,'runtime/bootstrap.js'),scripts[0][1]);
await writeFile(path.join(extension,'runtime/frame.html'),shell
  .replace(/<script>[\s\S]*?<\/script>/g,'')
  .replace(/<template id="eagler-runtime-script-template">[\s\S]*?<\/template>/,''));
const info={game:'th06',source,netplay:true,localSeatOnly:true,thcrap:!!unicode,originalGameDataIncluded:false,gameExecuted:false};
await writeFile(path.join(build,'source.json'),JSON.stringify(info,null,2));
console.log(`Load unpacked extension: ${extension}`);
