import{createDebugOverlay as l,readDebugFlag as c}from"./debugTools.js";const r=400,s=12,g=c("voicedebug","multiplix-voice-debug"),e=[];let t=null;function a(i,o=""){if(!g)return;const n=`${new Date().toISOString().slice(11,23)} ${i}${o?` ${o}`:""}`;console.debug(`[voice] ${n}`),e.push(n),e.length>r&&e.shift(),t??=l({copyLabel:"Copier le journal vocal",copyText:()=>e.join(`
`),position:"bottom"}),t.textContent=e.slice(-s).join(`
`)}export{a as voiceLog};

//# sourceMappingURL=voiceDebug.js.map
