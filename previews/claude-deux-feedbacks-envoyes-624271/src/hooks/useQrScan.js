import{useEffect as y,useRef as a}from"react";function p({active:o,onCode:c,onCameraError:s}){const n=a(null),u=a(c),i=a(s);return u.current=c,i.current=s,y(()=>{if(!o)return;let l=null,e=!1,t=!1;return(async()=>{try{const{default:f}=await import("qr-scanner");if(e||!n.current)return;const r=new f(n.current,async({data:d})=>{if(!t){t=!0;try{await u.current(d)&&r.stop()}finally{t=!1}}},{returnDetailedScanResult:!0});l=r,await r.start(),e&&r.destroy()}catch{e||i.current()}})(),()=>{e=!0,l?.destroy()}},[o]),n}export{p as useQrScan};

//# sourceMappingURL=useQrScan.js.map
