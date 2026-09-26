import{useCallback as i,useState as c}from"react";function s(){const[t,e]=c(!1),o=i(async a=>{try{await navigator.clipboard.writeText(a),e(!0),setTimeout(()=>e(!1),2e3)}catch{}},[]);return{copied:t,copy:o}}export{s as useCopyFeedback};

//# sourceMappingURL=useCopyFeedback.js.map
