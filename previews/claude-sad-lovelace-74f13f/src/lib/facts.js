function o(n,t){const e=Math.min(n,t),r=Math.max(n,t);return`${e}x${r}`}function c(){const n=[];for(let t=2;t<=9;t++)for(let e=t;e<=9;e++)n.push({a:t,b:e,product:t*e,box:1,lastSeen:"",nextDue:"",history:[],introduced:!1});return n}export{c as createInitialFacts,o as getFactKey};

//# sourceMappingURL=facts.js.map
