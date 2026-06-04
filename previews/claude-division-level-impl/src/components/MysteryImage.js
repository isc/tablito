import{jsx as l}from"preact/jsx-runtime";import{useMemo as y}from"react";import m from"./MysteryGrid.js";function c({facts:o,theme:n}){const i=y(()=>{const r=new Map;for(const t of o)r.set(`${t.a},${t.b}`,t);return r},[o]);return l(m,{theme:n,cellFor:(r,t)=>{const a=Math.min(r,t),s=Math.max(r,t),e=i.get(`${a},${s}`);return{level:e?.introduced?e.box:0,introduced:e?.introduced??!1,ariaLabel:`${r} fois ${t} = ${r*t}`,detailHeading:e?`${e.a} \xD7 ${e.b} = ${e.product}`:"",gridA:e?.a??a,gridB:e?.b??s,box:e?.box??1}}})}export{c as default};

//# sourceMappingURL=MysteryImage.js.map
