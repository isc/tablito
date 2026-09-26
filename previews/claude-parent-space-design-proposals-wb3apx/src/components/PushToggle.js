import{Fragment as c,jsx as o,jsxs as e}from"preact/jsx-runtime";function g({enabled:s,busy:a,message:n,onToggle:t,onLabel:l,offLabel:i}){return e(c,{children:[e("button",{type:"button",className:"notif-toggle",role:"switch","aria-checked":s,"aria-busy":a,disabled:a,onClick:t,children:[o("span",{className:"notif-toggle-label",children:s?l:i}),o("span",{className:`notif-switch ${s?"notif-switch--on":""}`,"aria-hidden":"true",children:o("span",{className:"notif-switch-knob"})})]}),n&&o("p",{className:"notif-message",children:n})]})}export{g as default};

//# sourceMappingURL=PushToggle.js.map
