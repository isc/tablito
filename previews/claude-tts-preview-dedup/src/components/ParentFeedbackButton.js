import{Fragment as b,jsx as t,jsxs as u}from"preact/jsx-runtime";import{useState as c}from"react";import{useParentDashboardStrings as s}from"../i18n/parent.js";import f from"./FeedbackModal.js";function p({profile:o,source:r}){const n=s(),[a,e]=c(!1);return u(b,{children:[t("button",{className:"parent-action-btn parent-feedback-btn",onClick:()=>e(!0),children:n.sendFeedback}),a&&t(f,{profile:o,source:r,onClose:()=>e(!1)})]})}export{p as default};

//# sourceMappingURL=ParentFeedbackButton.js.map
