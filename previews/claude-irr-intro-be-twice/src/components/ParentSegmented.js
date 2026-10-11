import{jsx as t}from"preact/jsx-runtime";function d({label:n,options:l,value:a,onChange:r,pill:s=!1}){return t("div",{className:`parent-segmented${s?" parent-segmented--pill":""}`,role:"group","aria-label":n,children:l.map(e=>t("button",{type:"button",className:`parent-segmented-option${e.value===a?" is-active":""}`,"aria-pressed":e.value===a,onClick:()=>r(e.value),children:e.label},e.value))})}export{d as default};

//# sourceMappingURL=ParentSegmented.js.map
