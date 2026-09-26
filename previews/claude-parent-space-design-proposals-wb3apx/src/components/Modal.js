import{jsx as d}from"preact/jsx-runtime";import{useEffect as s}from"react";function c({onClose:a,labelledBy:r,className:n,overlayClassName:i,disableClose:o,children:l}){return s(()=>{if(o)return;const e=t=>{t.key==="Escape"&&a()};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[a,o]),d("div",{className:`modal-overlay ${i??""}`,onClick:o?void 0:a,children:d("div",{className:`modal-card ${n??""}`,onClick:e=>e.stopPropagation(),role:"dialog","aria-modal":"true","aria-labelledby":r,children:l})})}export{c as default};

//# sourceMappingURL=Modal.js.map
