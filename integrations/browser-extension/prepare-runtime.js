globalThis.__eaglerAiPrepare=async()=>{
  try{
    // Read the original package table; never evaluate the stock runtime JS.
    // This preserves the site's installed original/beautified DATA layout.
    const documentResponse=await fetch(location.href);
    if(!documentResponse.ok)throw Error('无法读取原运行页');
    const original=new DOMParser().parseFromString(await documentResponse.text(),'text/html');
    const template=original.getElementById('eagler-runtime-script-template');
    const script=template?.content.querySelector('script')??original.querySelector('script[src]');
    const src=script?.getAttribute('src');
    if(!src)throw Error('未找到主站原运行包脚本');
    const response=await fetch(new URL(src,location.href));
    if(!response.ok)throw Error('无法读取原运行包资源表');
    const code=await response.text();
    const metadata=code.match(/(?:files|"files")\s*:\s*\[([^\]]*)\]\s*,\s*(?:remote_package_size|"remote_package_size")\s*:\s*(\d+)/);
    if(!metadata)throw Error('原运行包的 DATA 资源表格式已变化');
    const records=/\{\s*(?:filename|"filename")\s*:\s*("(?:[^"\\]|\\.)*")\s*,\s*(?:start|"start")\s*:\s*(\d+)\s*,\s*(?:end|"end")\s*:\s*(\d+)\s*\}/g;
    const files=[];
    const remainder=metadata[1].replace(records,(_match,filename,start,end)=>{
      files.push({path:JSON.parse(filename),start:Number(start),end:Number(end)});return '';
    }).replace(/[\s,]/g,'');
    if(remainder||!files.length)throw Error('原运行包的文件布局无法识别');
    const managed=globalThis.__eaglerManagedDataState;
    let buffer;
    if(managed?.enabled){
      const prepare=window.parent.__eaglerPrepareManagedRuntimeDataV1;
      if(typeof prepare!=='function')throw Error('主站未提供已安装资源接口');
      const payload=await prepare({game:managed.game,generation:managed.generation,epoch:globalThis.__eaglerRuntimeEpochV1});
      if(!payload?.buffer||payload.buffer.byteLength!==Number(payload.bytes))throw Error('主站游戏资源长度无效');
      buffer=payload.buffer;
    }else{
      const data=await fetch(new URL(Module.locateFile('th06.data'),location.href));
      if(!data.ok)throw Error('无法读取主站游戏资源');
      buffer=await data.arrayBuffer();
    }
    if(buffer.byteLength!==Number(metadata[2]))throw Error('游戏资源与原运行包文件表不匹配');
    let end=0;
    const paths=new Set();
    for(const file of files){
      if(!Number.isSafeInteger(file.start)||!Number.isSafeInteger(file.end)||
         file.start!==end||file.end<file.start||file.end>buffer.byteLength||paths.has(file.path))
        throw Error('游戏资源的文件边界无效');
      end=file.end;paths.add(file.path);
    }
    if(end!==buffer.byteLength)throw Error('游戏资源未完整覆盖');
    for(const suffix of ['CM','ED','IN','MD','ST','TL'])
      if(!paths.has(`/紅魔郷${suffix}.DAT`))throw Error('游戏资源缺少红魔乡 DAT');
    const data=new Uint8Array(buffer);
    // Only unpack game content. Never accept a package path under save roots.
    const allowed=/^\/(?:紅魔郷(?:CM|ED|IN|MD|ST|TL)\.DAT|eagler-hitbox\.png|msgothic\.ttc|unifont\.otf)$/;
    Module.preRun??=[];
    Module.preRun.push(()=>{
      for(const file of files)if(allowed.test(file.path))
        FS.writeFile(file.path,data.subarray(file.start,file.end));
    });
    return {ok:true};
  }catch(error){
    const message=String(error.message||error);
    globalThis.__eaglerAiStartupError=message;
    document.getElementById('status').textContent=`AI 接管加载失败：${message}`;
    return {ok:false,error:message};
  }
};
