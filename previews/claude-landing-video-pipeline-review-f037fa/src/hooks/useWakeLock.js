import{useEffect as r}from"react";function o(t){r(()=>{if(!t||typeof navigator>"u"||!("wakeLock"in navigator))return;let e=null,n=!1;const i=async()=>{try{const c=await navigator.wakeLock.request("screen");if(n){c.release().catch(()=>{});return}e=c}catch{}},a=()=>{document.visibilityState==="visible"&&!e&&i()};return i(),document.addEventListener("visibilitychange",a),()=>{n=!0,document.removeEventListener("visibilitychange",a),e&&(e.release().catch(()=>{}),e=null)}},[t])}export{o as useWakeLock};

//# sourceMappingURL=useWakeLock.js.map
