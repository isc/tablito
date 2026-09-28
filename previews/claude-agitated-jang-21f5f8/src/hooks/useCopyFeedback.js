import{useCallback as i,useEffect as n,useRef as u,useState as s}from"react";function p(){const[o,t]=s(!1),e=u(void 0);n(()=>()=>clearTimeout(e.current),[]);const r=i(async c=>{try{await navigator.clipboard.writeText(c),t(!0),clearTimeout(e.current),e.current=setTimeout(()=>t(!1),2e3)}catch{}},[]);return{copied:o,copy:r}}export{p as useCopyFeedback};

//# sourceMappingURL=useCopyFeedback.js.map
