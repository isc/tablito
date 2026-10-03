import{getStrategyTemplates as s}from"../i18n/strategies.js";function a(n,r){const t=Math.min(n,r),l=Math.max(n,r);if(t===2||t===l&&t===3)return null;for(const[i,e]of s())if(t===i||l===i){const u=i===t?l:t,o=e.steps(u,i*u);return{kind:e.kind,title:e.title,lines:e.aside?[o[0],e.aside(u),...o.slice(1)]:o,steps:o}}return null}function p(n,r){return a(n,r)!==null}export{a as getStrategy,p as hasStrategy};

//# sourceMappingURL=strategies.js.map
