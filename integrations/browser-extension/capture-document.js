(() => {
  if(window===window.top)return;
  const url=new URL(location.href);
  if(url.searchParams.get('hosted')!=='1'||url.searchParams.get('runtimeVariant')!=='multiplayer'||
     !/(?:^|\/)th06(?:-multiplayer)?(?:[/.\-]|$)/.test(url.pathname))return;
  // Stop the stock loader BEFORE its first script creates a Wasm instance.
  // Keep the frame URL/origin so the unmodified host's RPC checks remain valid.
  window.stop();
  chrome.runtime.sendMessage({type:'boot'},response=>{
    const error=chrome.runtime.lastError?.message||response?.error;
    if(error){
      document.documentElement.textContent=`AI 接管运行包加载失败：${error}。可关闭扩展后重新启动游戏。`;
    }
  });
})();
