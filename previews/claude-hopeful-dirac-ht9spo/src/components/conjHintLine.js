import{jsx as r}from"preact/jsx-runtime";function a(s){const c=s.split(/(\*[^*]+\*|_[^_]+_|\^[^^]+\^|~[^~]+~)/);return c.length===1?s:c.map((n,e)=>{if(e%2===0)return n;const t=n.slice(1,-1);switch(n[0]){case"*":return r("b",{className:"conj-hint-mark",children:t},e);case"_":return r("b",{className:"conj-hint-stem",children:t},e);case"^":return r("b",{className:"conj-hint-mark is-lit",children:t},e);case"~":return r("s",{className:"conj-hint-struck",children:t},e);default:return n}})}export{a as renderConjHintLine};

//# sourceMappingURL=conjHintLine.js.map
