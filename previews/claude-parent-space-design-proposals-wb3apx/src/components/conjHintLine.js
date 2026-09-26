import{jsx as i}from"preact/jsx-runtime";function c(t){const s=t.split(/(\*[^*]+\*|_[^_]+_)/);return s.length===1?t:s.map((e,n)=>e.startsWith("*")&&e.endsWith("*")?i("b",{className:"conj-hint-mark",children:e.slice(1,-1)},n):e.startsWith("_")&&e.endsWith("_")?i("b",{className:"conj-hint-stem",children:e.slice(1,-1)},n):e)}export{c as renderConjHintLine};

//# sourceMappingURL=conjHintLine.js.map
