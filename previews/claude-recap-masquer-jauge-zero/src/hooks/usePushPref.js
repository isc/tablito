import{useCallback as c,useEffect as h,useState as f}from"react";import{getPushPrefs as b,peekPushPrefs as g,setPushPref as p}from"../lib/push.js";function y(e,n){const[r,a]=f(()=>g()?.[e]??!1),[l,o]=f(!1),[i,u]=f(null);h(()=>{let s=!1;return b().then(t=>{s||a(t[e])}),()=>{s=!0}},[e]);const P=c(async()=>{if(!l){o(!0),u(null);try{const s=!r,t=await p(e,s);t==="ok"?a(s):u(t==="denied"?n.blocked:n.unavailable)}finally{o(!1)}}},[l,r,e,n]);return{enabled:r,busy:l,message:i,toggle:P}}export{y as usePushPref};

//# sourceMappingURL=usePushPref.js.map
