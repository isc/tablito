import{useCallback as P,useEffect as g,useState as a}from"react";import{getPushPrefs as b,setPushPref as h}from"../lib/push.js";function p(s,n){const[l,f]=a(!1),[r,i]=a(!1),[o,u]=a(null);g(()=>{let e=!1;return b().then(t=>{e||f(t[s])}),()=>{e=!0}},[s]);const c=P(async()=>{if(!r){i(!0),u(null);try{const e=!l,t=await h(s,e);t==="ok"?f(e):u(t==="denied"?n.blocked:n.unavailable)}finally{i(!1)}}},[r,l,s,n]);return{enabled:l,busy:r,message:o,toggle:c}}export{p as usePushPref};

//# sourceMappingURL=usePushPref.js.map
