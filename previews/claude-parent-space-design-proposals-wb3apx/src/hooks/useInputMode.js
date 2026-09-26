import{useCallback as p,useSyncExternalStore as c}from"react";const r="multiplix-input-mode";function u(){try{return localStorage.getItem(r)==="voice"?"voice":"keypad"}catch{return"keypad"}}function I(){return u()==="voice"}let o=u();const n=new Set;function s(e){return n.add(e),()=>{n.delete(e)}}function M(){return o}function l(){const e=c(s,M),d=p(t=>{if(o!==t){o=t;try{localStorage.setItem(r,t)}catch{}for(const i of[...n])i()}},[]);return{inputMode:e,setInputMode:d}}export{r as INPUT_MODE_STORAGE_KEY,I as isVoiceMode,l as useInputMode};

//# sourceMappingURL=useInputMode.js.map
