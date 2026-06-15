import{getStrategyTemplates as u}from"../i18n/strategies.js";function a(e,n){const t=Math.min(e,n),l=Math.max(e,n);if(t===2||t===l&&t===3)return null;for(const[r,o]of u())if(t===r||l===r){const i=r===t?l:t;return{kind:o.kind,title:o.title,lines:o.lines(i,r*i)}}return null}function d(e,n){return a(e,n)!==null}export{a as getStrategy,d as hasStrategy};

//# sourceMappingURL=strategies.js.map
