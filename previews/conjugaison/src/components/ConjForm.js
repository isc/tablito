import{jsx as n,jsxs as r}from"preact/jsx-runtime";function i({segment:c,subject:s,before:o,after:t,lit:a="none"}){const[m,e]=c;return r("span",{className:"conj-form",children:[o&&r("span",{className:"conj-form-context",children:[o," "]}),s&&n("span",{className:`conj-form-subject${a!=="none"?" is-lit":""}`,children:s}),n("span",{className:"conj-form-stem",children:m}),e!==""&&n("span",{className:`conj-form-mark${a==="both"?" is-lit":""}`,children:e}),t&&n("span",{className:"conj-form-context",children:t})]})}export{i as default};

//# sourceMappingURL=ConjForm.js.map
