const l="/previews/chore-dead-code/";function u(t){const n=new Map;for(const o of t.split(`
`)){const e=o.indexOf("	");if(e<=0)continue;const r=o.slice(0,e).toLowerCase(),i=o.slice(e+1).trim().split("|").filter(Boolean);i.length>0&&!n.has(r)&&n.set(r,i)}return n}let c=null;function a(){return c??=(async()=>{try{const t=await fetch(`${l}phonetic/fr.txt`);return t.ok?u(await t.text()):null}catch{return null}})(),c}function s(t,n){return t?t.get(n.toLowerCase())??[]:[]}function p(t,n,o){const e=s(t,n);return e.length===0?!1:s(t,o).some(i=>e.includes(i))}export{a as loadPhoneticDict,u as parsePhoneticDict,s as phonemesOf,p as sameSound};

//# sourceMappingURL=phoneticDict.js.map
