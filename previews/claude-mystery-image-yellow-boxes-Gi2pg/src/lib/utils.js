function r(){return new Date().toISOString().slice(0,10)}function a(e,t){const n=new Date(e),o=new Date(t);return Math.round((o.getTime()-n.getTime())/(1e3*60*60*24))}function i(e){const t=[...e];for(let n=t.length-1;n>0;n--){const o=Math.floor(Math.random()*(n+1));[t[n],t[o]]=[t[o],t[n]]}return t}function u(e){return e[Math.floor(Math.random()*e.length)]}export{a as daysBetween,u as pickRandom,i as shuffle,r as todayISO};

//# sourceMappingURL=utils.js.map
