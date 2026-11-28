import{useEffect as u,useRef as a,useState as d}from"react";function c(t){const e=a(t);e.current=t;const o=t!==null,[s,r]=d(0);u(()=>{if(!o)return;window.history.pushState({tablitoBack:!0},"");const n=()=>{e.current?.(),r(i=>i+1)};return window.addEventListener("popstate",n),()=>{window.removeEventListener("popstate",n),window.history.state?.tablitoBack&&window.history.back()}},[o,s])}export{c as useBackGesture};

//# sourceMappingURL=useBackGesture.js.map
