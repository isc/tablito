import{jsx as s}from"preact/jsx-runtime";const e=["var(--indigo)","var(--sage)","var(--coral)"];function n(r){let a=0;for(let t=0;t<r.length;t++)a=a*31+r.charCodeAt(t)|0;return e[Math.abs(a)%e.length]}function o({name:r,className:a}){return s("span",{className:a,style:{background:n(r)},"aria-hidden":"true",children:r.trim().charAt(0).toUpperCase()})}export{o as default};

//# sourceMappingURL=ProfileAvatar.js.map
