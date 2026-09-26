import{useCallback as c,useEffect as g,useState as f}from"react";import{getPushPrefs as h,peekPushPrefs as b,setPushPref as d}from"../lib/push.js";function y(e,n){const[r,a]=f(()=>b()?.[e]??!1),[l,i]=f(!1),[o,u]=f(null);g(()=>{let s=!1;return h().then(t=>{s||a(t[e])}),()=>{s=!0}},[e]);const P=c(async()=>{if(!l){i(!0),u(null);try{const s=!r,t=await d(e,s);t==="ok"?a(s):u(t==="denied"?n.blocked:n.unavailable)}finally{i(!1)}}},[l,r,e,n]);return{enabled:r,busy:l,message:o,toggle:P}}export{y as usePushPref};

//# sourceMappingURL=usePushPref.js.map
