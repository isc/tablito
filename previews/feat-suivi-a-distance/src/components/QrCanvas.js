import{jsx as u}from"preact/jsx-runtime";import{useEffect as f,useRef as s}from"react";function i({value:e,ariaLabel:c,className:l,onError:n}){const r=s(null),t=s(n);return t.current=n,f(()=>{let a=!1;return import("lean-qr").then(({generate:o})=>{!a&&r.current&&o(e).toCanvas(r.current)}).catch(()=>{a||t.current?.()}),()=>{a=!0}},[e]),u("canvas",{ref:r,className:l,role:"img","aria-label":c})}export{i as default};

//# sourceMappingURL=QrCanvas.js.map
