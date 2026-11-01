function o(t){return Math.floor(t/10)}function u(t){const n=new Set,e=String(t);for(const r of e)n.add(Number(r));return n}function i(t,n){for(const e of t)if(n.has(e))return!0;return!1}function c(t,n){const e=new Set([t.a,t.b]),r=new Set([n.a,n.b]);if(i(e,r))return"strong";if(o(t.product)===o(n.product))return"medium";const s=u(t.product),m=u(n.product);return i(s,m)?"medium":"none"}export{c as computeSimilarity};

//# sourceMappingURL=similarity.js.map
