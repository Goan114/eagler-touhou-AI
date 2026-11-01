const $=id=>document.getElementById(id);
let serial=0;
async function request(action='status',extra={}){
  const ticket=++serial;
  try{
    const state=await chrome.runtime.sendMessage({type:'control',action,...extra});
    if(ticket!==serial)return;
    if(!state?.ok)throw Error(state?.error||'运行包尚未连接');
    const s=state.settings;
    $('enabled').checked=s.enabled;$('strength').value=s.strength;$('team').value=String(s.team);
    for(const input of document.querySelectorAll('input[type=range]')){
      input.value=s[input.id];
      document.querySelector(`output[for="${input.id}"]`).textContent=input.id==='switchWeight'?Number(input.value).toFixed(3):input.value;
    }
    $('status').textContent=!state.ready?'AI 运行包正在加载…':
      `${s.enabled?'AI 已开启':'当前手动操作'} · 你的座位 P${state.seat+1}\n${state.active?'正在接管':'等待关卡／暂停中'}\n读取危险物 ${state.hazards} · 搜索 ${state.ms.toFixed(2)} ms`;
  }catch(error){$('status').textContent=error.message;}
}
$('enabled').onchange=()=>request('enabled',{value:$('enabled').checked});
$('strength').onchange=()=>request('preset',{value:$('strength').value});
$('team').onchange=()=>request('team',{value:Number($('team').value)});
for(const input of document.querySelectorAll('input[type=range]'))
  input.oninput=()=>request('parameter',{key:input.id,value:Number(input.value)});
request();setInterval(()=>request(),1000);
