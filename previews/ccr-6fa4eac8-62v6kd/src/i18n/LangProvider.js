import{jsx as u}from"preact/jsx-runtime";import{useCallback as g,useEffect as r,useState as c}from"react";import{LangContext as L,applyLang as d,getLang as l}from"./lang.js";function p({children:n}){const[e,a]=c(l()),o=g(t=>{d(t),a(t)},[]);return r(()=>{try{document.documentElement.lang=e}catch{}},[e]),u(L.Provider,{value:{lang:e,setLang:o},children:n})}export{p as LangProvider};

//# sourceMappingURL=LangProvider.js.map
