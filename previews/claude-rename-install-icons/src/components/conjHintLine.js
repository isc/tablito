import{jsx as n}from"preact/jsx-runtime";function a(s){const c=s.split(/(\*[^*]+\*|_[^_]+_|\^[^^]+\^|~[^~]+~)/);return c.length===1?s:c.map((r,e)=>{if(e%2===0)return r;const t=r.slice(1,-1);switch(r[0]){case"*":return n("b",{className:"conj-hint-mark",children:t},e);case"_":return n("b",{className:"conj-hint-stem",children:t},e);case"^":return n("b",{className:"conj-hint-mark is-lit",children:t},e);default:return n("s",{className:"conj-hint-struck",children:t},e)}})}export{a as renderConjHintLine};

//# sourceMappingURL=conjHintLine.js.map
