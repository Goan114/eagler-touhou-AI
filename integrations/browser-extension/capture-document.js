(() => {
  if(window===window.top)return;
  const url=new URL(location.href);
  if(url.searchParams.get('hosted')!=='1'||url.searchParams.get('runtimeVariant')!=='multiplayer'||
     !/(?:^|\/)th06(?:-multiplayer)?(?:[/.\-]|$)/.test(url.pathname))return;
  let requested=false;
  window.addEventListener('message',event=>{
    if(requested||event.source!==window||event.origin!==location.origin||
       event.data?.protocol!=='eagler-ai-extension/1'||event.data.event!=='runtime-intercepted')return;
    requested=true;
    chrome.runtime.sendMessage({type:'boot'},response=>{
      const error=chrome.runtime.lastError?.message||response?.error;
      if(error){
        const status=document.getElementById('status');
        if(status)status.textContent=`AI 接管运行包加载失败：${error}。可关闭扩展后重新启动游戏。`;
        console.error('[Eagler AI]',error);
      }
    });
  });
})();
