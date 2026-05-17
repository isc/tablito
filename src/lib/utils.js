function o(){return new Date().toISOString().slice(0,10)}function i(e,t){const n=new Date(e),r=new Date(t);return Math.round((r.getTime()-n.getTime())/(1e3*60*60*24))}function a(e){const t=[...e];for(let n=t.length-1;n>0;n--){const r=Math.floor(Math.random()*(n+1));[t[n],t[r]]=[t[r],t[n]]}return t}function u(e){return e[Math.floor(Math.random()*e.length)]}function s(e,t,n){return e===1?t:n??`${t}s`}export{i as daysBetween,u as pickRandom,s as pluralize,a as shuffle,o as todayISO};

//# sourceMappingURL=utils.js.map
