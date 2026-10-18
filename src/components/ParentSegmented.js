import{jsx as n}from"preact/jsx-runtime";function i({label:t,options:l,value:a,onChange:s,pill:r=!1,kid:d=!1}){return n("div",{className:`parent-segmented${r?" parent-segmented--pill":""}${d?" parent-segmented--kid":""}`,role:"group","aria-label":t,children:l.map(e=>n("button",{type:"button",className:`parent-segmented-option${e.value===a?" is-active":""}`,"aria-pressed":e.value===a,onClick:()=>s(e.value),children:e.label},e.value))})}export{i as default};

//# sourceMappingURL=ParentSegmented.js.map
