import{createDebugOverlay as u,readDebugFlag as c,setDebugFlag as g}from"./debugTools.js";const s=400,a=12,r="multiplix-voice-debug";let n=c("voicedebug",r);const e=[];let t=null;function p(){return n}function b(o){n=o,g(r,o),!o&&(e.length=0,t?.remove(),t=null)}function f(o,i=""){if(!n)return;const l=`${new Date().toISOString().slice(11,23)} ${o}${i?` ${i}`:""}`;console.debug(`[voice] ${l}`),e.push(l),e.length>s&&e.shift(),t??=u({copyLabel:"Copier le journal vocal",copyText:()=>e.join(`
`),position:"bottom",onDisable:()=>b(!1)}),t.log.textContent=e.slice(-a).join(`
`)}export{p as isVoiceDebugOn,b as setVoiceDebug,f as voiceLog};

//# sourceMappingURL=voiceDebug.js.map
