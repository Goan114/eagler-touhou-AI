const runtimeFrame=url=>{
  try{
    const u=new URL(url);
    return /^(?:touhou\.vip|[^/]+\.touhou\.vip|127\.0\.0\.1|localhost)$/.test(u.hostname)&&
      u.searchParams.get('hosted')==='1'&&u.searchParams.get('runtimeVariant')==='multiplayer'&&
      /(?:^|\/)th06(?:-multiplayer)?(?:[/.\-]|$)/.test(u.pathname);
  }catch{return false;}
};
let wasmPromise;
const wasmBase64=()=>wasmPromise??=(async()=>{
  const response=await fetch(chrome.runtime.getURL('runtime/th06.wasm'));
  if(!response.ok)throw Error('AI Wasm 文件缺失，请重新构建扩展');
  const bytes=new Uint8Array(await response.arrayBuffer());
  const chunks=[];
  for(let i=0;i<bytes.length;i+=0x8000)chunks.push(String.fromCharCode(...bytes.subarray(i,i+0x8000)));
  return btoa(chunks.join(''));
})().catch(error=>{wasmPromise=null;throw error;});

async function boot(sender){
  if(!sender.tab||!sender.frameId||!runtimeFrame(sender.url))throw Error('不支持的游戏页面');
  const target={tabId:sender.tab.id,frameIds:[sender.frameId]};
  const html=await (await fetch(chrome.runtime.getURL('runtime/frame.html'))).text();
  const encoded=await wasmBase64();
  await chrome.scripting.executeScript({target,world:'MAIN',func:markup=>{
    document.open();document.write(markup);document.close();
  },args:[html]});
  await chrome.scripting.executeScript({target,world:'MAIN',files:['runtime/bootstrap.js']});
  await chrome.scripting.executeScript({target,world:'MAIN',files:['prepare-runtime.js']});
  const prepared=await chrome.scripting.executeScript({target,world:'MAIN',func:()=>globalThis.__eaglerAiPrepare()});
  const result=prepared[0]?.result;
  if(!result?.ok)throw Error(result?.error||'无法读取主站已有游戏资源');
  await chrome.scripting.executeScript({target,world:'MAIN',func:base64=>{
    Module.wasmBinary=Uint8Array.from(atob(base64),character=>character.charCodeAt(0));
    Module.onAbort=reason=>{
      globalThis.__eaglerAiStartupError=String(reason);
      document.getElementById('status').textContent=`AI 运行包错误：${reason}`;
    };
  },args:[encoded]});
  await chrome.scripting.executeScript({target,world:'MAIN',files:['runtime/th06.js']});
  await chrome.scripting.executeScript({target,world:'MAIN',files:['runtime-controls.js']});
  await chrome.action.setBadgeText({tabId:sender.tab.id,text:'AI'});
  return {ok:true};
}

async function control(message){
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id)throw Error('请先打开主站');
  const replies=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},world:'MAIN',
    func:request=>{
      if(globalThis.__eaglerAiStartupError)return {ok:false,error:globalThis.__eaglerAiStartupError};
      if(!globalThis.__eaglerAiControls)return null;
      return globalThis.__eaglerAiControls(request);
    },args:[message]});
  const reply=replies.find(entry=>entry.result)?.result;
  if(!reply)throw Error('请启用扩展后，在主站重新启动红魔乡多人游戏');
  return reply;
}

chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(message?.type!=='boot'&&message?.type!=='control')return;
  if(message.type==='control'&&sender.url!==chrome.runtime.getURL('popup.html'))return;
  (message.type==='boot'?boot(sender):control(message)).then(respond,error=>respond({ok:false,error:String(error.message||error)}));
  return true;
});
