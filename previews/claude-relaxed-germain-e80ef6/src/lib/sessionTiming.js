const c=2e4,h=4;function a(n){if(n.length===0)return 0;const t=[...n].sort((r,e)=>r-e);return t[Math.floor(t.length/2)]}function u(n){if(n.length===0)return 0;const t=Math.max(2e4,4*a(n)),r=n.filter(o=>o<=t),e=Math.max(...r),R=n.reduce((o,A)=>o+Math.min(A,e),0);return Math.round(R/n.length)}export{h as ABERRANT_ANSWER_FACTOR,c as ABERRANT_ANSWER_FLOOR_MS,u as normalizedAverageMs};

//# sourceMappingURL=sessionTiming.js.map
