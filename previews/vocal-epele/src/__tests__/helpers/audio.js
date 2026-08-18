function a({endAfterMs:r}={}){const t=globalThis.AudioContext,o=t.prototype.createBufferSource;let u=0,n=!1;return t.prototype.createBufferSource=function(){const e=o.call(this),c=e.start.bind(e);return e.start=((...s)=>(u+=1,r!==void 0&&setTimeout(()=>e.onended?.(new Event("ended")),r),c(...s))),e},{starts:()=>u,restore:()=>{n||(n=!0,t.prototype.createBufferSource=o)}}}export{a as patchBufferSource};

//# sourceMappingURL=audio.js.map
