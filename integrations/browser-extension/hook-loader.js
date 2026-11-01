(() => {
  if(window===window.top)return;
  const url=new URL(location.href);
  if(url.searchParams.get('hosted')!=='1'||url.searchParams.get('runtimeVariant')!=='multiplayer'||
     !/(?:^|\/)th06(?:-multiplayer)?(?:[/.\-]|$)/.test(url.pathname))return;
  if(globalThis.__eaglerAiLoader)return;
  const state=globalThis.__eaglerAiLoader={phase:'等待主站加载器',originalSrc:'',intercepted:false};
  const replaceWith=Element.prototype.replaceWith;
  function intercept(...nodes){
    if(this.id!=='eagler-runtime-script-template'||state.intercepted)
      return replaceWith.apply(this,nodes);
    const script=nodes.find(node=>node?.nodeType===1&&node.tagName==='SCRIPT');
    const src=script?.getAttribute('src');
    if(!src)return replaceWith.apply(this,nodes);
    const originalUrl=new URL(src,location.href);
    if(originalUrl.origin!==location.origin||!originalUrl.pathname.endsWith('/th06.js'))
      return replaceWith.apply(this,nodes);
    state.intercepted=true;state.originalSrc=originalUrl.href;state.phase='等待扩展加载内核';
    // The stock bootstrap has already created the canvas, Module, RPC owners
    // and managed DATA provider. Leave them and the navigation untouched.
    // Keep the original script inside its inert template; only swap its core.
    if(Element.prototype.replaceWith===intercept)Element.prototype.replaceWith=replaceWith;
    const status=document.getElementById('status');
    if(status)status.textContent='正在加载 AI 接管内核…';
    window.postMessage({protocol:'eagler-ai-extension/1',event:'runtime-intercepted'},location.origin);
  }
  Element.prototype.replaceWith=intercept;
})();
