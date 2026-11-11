(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const state = {
    mode: "demo", system: "RUNNING", operation: "AUTO", fanOn: true, fanSpeed: 45,
    apiUrl: "", pollMs: 2000, timer: null, startedAt: Date.now(), history: [],
    samples: [], thresholds: { maxTemp: 70, maxHumidity: 80, maxBasalt: 90 },
    lastDataAt: Date.now(), data: { temperature_inside: 52.4, temperature_outside: 31, temperature_bazalt: 48.2, humidity: 38, fan_status: true, fan_speed: 45, fan_power: 18.5, system_status: "RUNNING" }
  };
  const pageTitles = { overview:"Tổng quan hệ thống", monitoring:"Giám sát thông số", control:"Điều khiển hệ thống", thermal:"Giám sát đá tích nhiệt Bazan", history:"Lịch sử hoạt động", settings:"Cài đặt hệ thống" };
  let toastTimer;
  function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove("show"),2600); }
  function log(event, detail) {
    state.history.unshift({ time:new Date().toLocaleString("vi-VN"), event, detail, mode:state.mode.toUpperCase() });
    state.history=state.history.slice(0,250); renderHistory();
  }
  function setPage(name) {
    document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${name}`));
    document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
    $("pageTitle").textContent=pageTitles[name]||"SOLAR DRYER";
    $("sidebar").classList.remove("open");
    setTimeout(drawAllCharts,50);
  }
  document.querySelectorAll(".nav-link").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.page)));
  document.querySelectorAll("[data-goto]").forEach(b=>b.addEventListener("click",()=>setPage(b.dataset.goto)));
  $("menuBtn").addEventListener("click",()=>$("sidebar").classList.toggle("open"));
  function addSample() {
    const d=state.data;
    state.samples.push({time:new Date(), inside:+d.temperature_inside, outside:+d.temperature_outside, basalt:+d.temperature_bazalt, humidity:+d.humidity, power:+d.fan_power});
    if(state.samples.length>100) state.samples.shift();
    drawAllCharts();
  }
  function demoTick() {
    if(state.mode!=="demo") return;
    const d=state.data;
    const running=state.system==="RUNNING";
    d.temperature_outside=clamp(d.temperature_outside+(Math.random()-.5)*.25,27,36);
    d.temperature_inside=clamp(d.temperature_inside+(running?(Math.random()-.43)*.45:(Math.random()-.5)*.08),30,68);
    d.temperature_bazalt=clamp(d.temperature_bazalt+(running?(Math.random()-.47)*.22:(Math.random()-.5)*.06),28,65);
    d.humidity=clamp(d.humidity+(running?(Math.random()-.52)*.7:(Math.random()-.5)*.12),20,75);
    d.fan_status=state.fanOn && running;
    d.fan_speed=d.fan_status?state.fanSpeed:0;
    d.fan_power=d.fan_status?+(2+state.fanSpeed*.37).toFixed(1):0;
    d.system_status=state.system;
    state.lastDataAt=Date.now();
    updateUI(); addSample(); checkAlerts();
  }
  function clamp(v,min,max){return Math.min(max,Math.max(min,v));}
  function updateUI() {
    const d=state.data;
    setText("tempInside",fmt(d.temperature_inside)); setText("tempOutside",fmt(d.temperature_outside));
    setText("humidity",fmt(d.humidity)); setText("tempBasalt",fmt(d.temperature_bazalt));
    setText("fanPower",fmt(d.fan_power)); setText("fanSpeedMetric",Math.round(d.fan_speed));
    setText("fanSpeedLabel",`${Math.round(state.fanSpeed)}%`); setText("fanSpeedLarge",`${Math.round(state.fanSpeed)}%`);
    setText("fanStatusText",d.fan_status?"Máy thổi đang chạy":"Máy thổi đang dừng");
    setText("quickFanStatus",d.fan_status?"ĐANG CHẠY":"ĐANG DỪNG");
    setText("fanControlStatus",d.fan_status?"ĐANG CHẠY":"ĐANG DỪNG");
    setText("fanSafety",d.fan_status?"Đang chạy":"Đang dừng");
    setText("thermalTemp",fmt(d.temperature_bazalt)); setText("thermalNow",fmt(d.temperature_bazalt));
    setText("thermalInside",fmt(d.temperature_inside)); setText("thermalDelta",fmt(Math.abs(d.temperature_inside-d.temperature_bazalt)));
    setText("thermalPhase",d.temperature_bazalt>d.temperature_outside+12?"Đang tích trữ nhiệt":"Đang giải phóng / cân bằng nhiệt");
    setText("systemStatus",state.system==="RUNNING"?"Hệ thống đang hoạt động":state.system==="PAUSED"?"Hệ thống đang tạm dừng":"Hệ thống đã dừng");
    setText("controlState",state.system==="RUNNING"?"Hệ thống đang hoạt động":state.system==="PAUSED"?"Hệ thống đang tạm dừng":"Hệ thống đã dừng");
    setText("controlBadge",state.system); setText("uptime",uptime());
    $("fanSlider").value=state.fanSpeed; $("fanSliderLarge").value=state.fanSpeed;
    $("autoBtn").classList.toggle("selected",state.operation==="AUTO"); $("manualBtn").classList.toggle("selected",state.operation==="MANUAL");
    $("controlAuto").classList.toggle("selected",state.operation==="AUTO"); $("controlManual").classList.toggle("selected",state.operation==="MANUAL");
    const canAdjust=state.operation==="MANUAL" && state.system==="RUNNING";
    $("fanSlider").disabled=!canAdjust; $("fanSliderLarge").disabled=!canAdjust;
    $("systemDot").classList.toggle("off",state.system!=="RUNNING");
    $("controlBadge").className=state.system==="RUNNING"?"badge badge-green":"badge badge-red";
    $("modePill").innerHTML=`<i class="dot ${state.mode==="hardware"?"":" " }"></i> ${state.mode==="demo"?"DEMO MODE":"HARDWARE MODE"}`;
    $("sideConnection").textContent=state.mode==="demo"?"DEMO đang chạy":"ESP32 đã kết nối";
    $("sideMode").textContent=state.mode==="demo"?"Dữ liệu mô phỏng":"HTTP REST API";
    $("deviceDetail").textContent=state.mode==="demo"?"Chưa kết nối · đang chạy DEMO":`API: ${state.apiUrl}`;
    $("deviceBadge").textContent=state.mode.toUpperCase();
    $("wifiSafety").textContent=state.mode==="demo"?"DEMO":"ONLINE";
    $("dataFreshness").textContent=Date.now()-state.lastDataAt<8000?"Mới":"Cũ";
  }
  function fmt(v){return Number(v).toFixed(1);}
  function setText(id,v){$(id).textContent=v;}
  function uptime(){const sec=Math.floor((Date.now()-state.startedAt)/1000);return `${String(Math.floor(sec/3600)).padStart(2,"0")}:${String(Math.floor(sec%3600/60)).padStart(2,"0")}`;}
  async function apiRequest(path,method="GET",body) {
    const base=state.apiUrl.replace(/\/+$/,"");
    if(!base) throw new Error("Chưa nhập địa chỉ API của ESP32.");
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),3500);
    try {
      const res=await fetch(base+path,{method,headers:{"Content-Type":"application/json"},body:body?JSON.stringify(body):undefined,signal:controller.signal});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const type=res.headers.get("content-type")||"";
      return type.includes("application/json")?await res.json():{};
    } finally {clearTimeout(timeout);}
  }
  async function sendCommand(command) {
    if(state.mode==="demo") {
      if(command==="START"){state.system="RUNNING";state.startedAt=Date.now();}
      if(command==="PAUSE")state.system="PAUSED";
      if(command==="STOP"){state.system="STOPPED";state.fanOn=false;state.fanSpeed=0;}
      if(command==="AUTO"||command==="MANUAL")state.operation=command;
      state.data.system_status=state.system; updateUI(); log(command,`Lệnh ${command} thực hiện trong DEMO.`); toast(`Đã thực hiện ${command} trong DEMO.`); return;
    }
    try {
      const result=await apiRequest("/api/command","POST",{command});
      if(result.ok===false) throw new Error(result.message||"Thiết bị từ chối lệnh.");
      await pollHardware();
      log(command,`ESP32 xác nhận lệnh ${command}.`); toast(`ESP32 đã nhận lệnh ${command}.`);
    } catch(e){toast(`Không gửi được lệnh: ${e.message}`); log("Lỗi điều khiển",e.message);}
  }
  async function setFanSpeed(value) {
    state.fanSpeed=Number(value); updateUI();
    if(state.mode==="demo"){state.data.fan_speed=state.fanSpeed;return;}
    try {const result=await apiRequest("/api/fan","POST",{speed:state.fanSpeed});if(result.ok===false)throw new Error(result.message||"Không được chấp nhận");toast("Đã gửi tốc độ máy thổi.");}
    catch(e){toast(`Lỗi điều chỉnh máy thổi: ${e.message}`);}
  }
  async function pollHardware() {
    try {
      const d=await apiRequest("/api/status");
      const normalized={
        temperature_inside:d.temperature_inside,temperature_outside:d.temperature_outside,
        temperature_bazalt:d.temperature_bazalt,humidity:d.humidity,fan_status:d.fan_status,
        fan_speed:d.fan_speed,fan_power:d.fan_power,system_status:d.system_status
      };
      for(const [k,v] of Object.entries(normalized)){if(v===undefined||v===null||!Number.isFinite(typeof v==="number"?v:1))throw new Error(`Thiếu hoặc sai dữ liệu: ${k}`);}
      state.data={...state.data,...normalized}; state.system=d.system_status||state.system;
      state.fanSpeed=Number(d.fan_speed)||0; state.fanOn=!!d.fan_status; state.lastDataAt=Date.now();
      $("sideDot").classList.remove("off"); $("connectionMessage").textContent="Đã nhận dữ liệu từ ESP32.";
      updateUI();addSample();checkAlerts();
    } catch(e) {
      $("sideDot").classList.add("off"); $("connectionMessage").textContent=`Không đọc được dữ liệu: ${e.message}`;
      setText("sideConnection","Mất kết nối"); $("dataFreshness").textContent="Mất dữ liệu";
    }
  }
  async function connectHardware() {
    state.apiUrl=$("apiUrl").value.trim(); state.pollMs=clamp(Number($("pollInterval").value)||2000,1000,30000);
    if(!/^https?:\/\/.+/i.test(state.apiUrl)){toast("Vui lòng nhập URL, ví dụ http://192.168.1.50");return;}
    try {
      const d=await apiRequest("/api/status");
      state.mode="hardware";state.data={...state.data,...d};state.system=d.system_status||"STOPPED";state.fanSpeed=Number(d.fan_speed)||0;
      clearInterval(state.timer);state.timer=setInterval(pollHardware,state.pollMs);
      state.lastDataAt=Date.now();updateUI();addSample();log("Kết nối phần cứng",`Kết nối thành công: ${state.apiUrl}`);toast("Kết nối ESP32 thành công.");$("connectionMessage").textContent="Đã kết nối. Website đang nhận dữ liệu từ ESP32.";
    } catch(e){toast(`Kết nối thất bại: ${e.message}`);$("connectionMessage").textContent=`Kết nối thất bại: ${e.message}. Kiểm tra IP, Wi-Fi và CORS.`;}
  }
  function switchDemo() {
    clearInterval(state.timer);state.mode="demo";state.system="RUNNING";state.operation="AUTO";state.fanOn=true;state.fanSpeed=45;
    state.data={temperature_inside:52.4,temperature_outside:31,temperature_bazalt:48.2,humidity:38,fan_status:true,fan_speed:45,fan_power:18.5,system_status:"RUNNING"};
    state.lastDataAt=Date.now();state.startedAt=Date.now();$("connectionMessage").textContent="Đang sử dụng dữ liệu mô phỏng.";state.timer=setInterval(demoTick,2000);updateUI();log("Chuyển chế độ","Đã chuyển sang DEMO MODE.");toast("Đã chuyển sang DEMO MODE.");
  }
  function checkAlerts() {
    const d=state.data, alerts=[];
    if(d.temperature_inside>state.thresholds.maxTemp)alerts.push(`Nhiệt độ trong tủ vượt ${state.thresholds.maxTemp}°C.`);
    if(d.humidity>state.thresholds.maxHumidity)alerts.push(`Độ ẩm vượt ${state.thresholds.maxHumidity}%RH.`);
    if(d.temperature_bazalt>state.thresholds.maxBasalt)alerts.push(`Nhiệt độ đá Bazan vượt ${state.thresholds.maxBasalt}°C.`);
    $("alertList").innerHTML=alerts.length?alerts.map(a=>`<div class="alert-item">⚠ ${escapeHTML(a)}</div>`).join(""):'<div class="empty-state">✓ Chưa có cảnh báo mới.</div>';
  }
  function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
  function renderHistory() {
    $("historyCount").textContent=`${state.history.length} sự kiện`;
    $("historyBody").innerHTML=state.history.length?state.history.map(x=>`<tr><td>${escapeHTML(x.time)}</td><td><b>${escapeHTML(x.event)}</b></td><td>${escapeHTML(x.detail)}</td><td>${escapeHTML(x.mode)}</td></tr>`).join(""):'<tr><td colspan="4" class="empty-state">Chưa có dữ liệu lịch sử.</td></tr>';
  }
  function exportCSV() {
    const rows=[["Thời gian","Sự kiện","Chi tiết","Chế độ"],...state.history.map(x=>[x.time,x.event,x.detail,x.mode])];
    const csv="\uFEFF"+rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const a=document.createElement("a"),url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));a.href=url;a.download="solar-dryer-history.csv";a.click();URL.revokeObjectURL(url);
  }
  function drawChart(canvasId,series,limit) {
    const canvas=$(canvasId);if(!canvas||!canvas.getContext)return;
    const rect=canvas.getBoundingClientRect();if(rect.width<10)return;
    const ratio=window.devicePixelRatio||1,w=rect.width,h=Number(canvas.getAttribute("height"))||220;
    canvas.width=w*ratio;canvas.height=h*ratio;const ctx=canvas.getContext("2d");ctx.scale(ratio,ratio);
    ctx.clearRect(0,0,w,h);
    const pad={l:34,r:10,t:12,b:26},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
    const data=state.samples.slice(-limit);if(data.length<2)return;
    const vals=data.flatMap(d=>series.map(s=>d[s.key])).filter(Number.isFinite);
    let min=Math.floor(Math.min(...vals)-3),max=Math.ceil(Math.max(...vals)+3);if(max-min<10){max+=5;min-=5;}
    ctx.font="10px DM Sans, sans-serif";ctx.fillStyle="#9aa69f";ctx.strokeStyle="#edf1ee";ctx.lineWidth=1;
    for(let i=0;i<5;i++){const y=pad.t+ch*i/4;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText((max-(max-min)*i/4).toFixed(0),2,y+3);}
    series.forEach(s=>{ctx.strokeStyle=s.color;ctx.lineWidth=2.2;ctx.lineJoin="round";ctx.lineCap="round";ctx.beginPath();data.forEach((d,i)=>{const x=pad.l+cw*i/(data.length-1),y=pad.t+ch*(max-d[s.key])/(max-min);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();});
    ctx.fillStyle="#9aa69f";ctx.fillText("Gần đây",pad.l,h-6);ctx.fillText("Hiện tại",w-52,h-6);
  }
  function drawAllCharts() {
    const thermal=[{key:"basalt",color:"#c99a31"}],temps=[{key:"inside",color:"#ed8a35"},{key:"outside",color:"#4289bd"},{key:"basalt",color:"#c99a31"}];
    drawChart("overviewChart",temps,30);drawChart("monitorTempChart",temps,Number($("rangeSelect").value)||20);
    drawChart("monitorOtherChart",[{key:"humidity",color:"#4289bd"},{key:"power",color:"#16845a"}],30);
    drawChart("thermalChart",thermal,40);
  }
  function bind() {
    ["quickStart","startBtn"].forEach(id=>$(id).addEventListener("click",()=>sendCommand("START")));
    ["quickPause","pauseBtn"].forEach(id=>$(id).addEventListener("click",()=>sendCommand("PAUSE")));
    ["quickStop","stopBtn"].forEach(id=>$(id).addEventListener("click",()=>sendCommand("STOP")));
    ["autoBtn","controlAuto"].forEach(id=>$(id).addEventListener("click",()=>sendCommand("AUTO")));
    ["manualBtn","controlManual"].forEach(id=>$(id).addEventListener("click",()=>sendCommand("MANUAL")));
    ["fanSlider","fanSliderLarge"].forEach(id=>$(id).addEventListener("change",e=>setFanSpeed(e.target.value)));
    $("connectBtn").addEventListener("click",connectHardware);$("demoBtn").addEventListener("click",switchDemo);
    $("saveThresholds").addEventListener("click",()=>{state.thresholds={maxTemp:Number($("maxTemp").value),maxHumidity:Number($("maxHumidity").value),maxBasalt:Number($("maxBasalt").value)};checkAlerts();$("thresholdMessage").textContent="Đã lưu ngưỡng cảnh báo trong phiên trình duyệt này.";toast("Đã cập nhật ngưỡng cảnh báo.");});
    $("exportBtn").addEventListener("click",exportCSV);$("rangeSelect").addEventListener("change",drawAllCharts);
  }
  function tickClock(){ $("clock").textContent=new Date().toLocaleTimeString("vi-VN"); }
  function init(){
    bind();for(let i=0;i<24;i++){const d=state.data;state.samples.push({time:new Date(Date.now()-(23-i)*2000),inside:d.temperature_inside+(Math.random()-.5)*3,outside:d.temperature_outside+(Math.random()-.5),basalt:d.temperature_bazalt+(Math.random()-.5)*2,humidity:d.humidity+(Math.random()-.5)*3,power:d.fan_power+(Math.random()-.5)*2});}
    updateUI();renderHistory();checkAlerts();drawAllCharts();state.timer=setInterval(demoTick,2000);setInterval(tickClock,1000);tickClock();
    log("Khởi động website","Website bắt đầu ở chế độ DEMO.");
    window.addEventListener("resize",()=>drawAllCharts());
  }
  init();
})();