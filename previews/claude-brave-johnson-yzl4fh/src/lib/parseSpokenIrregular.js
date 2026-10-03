import{canonicalizeIrrWord as i,irrExpectedForms as s,irrSlotCount as t}from"./irregularVerbs.js";const o=new Set(["to","and","then","um","uh","er","erm","hmm","the"]);function p(e,r){return e.split(/[\s,.;!?-]+/).map(n=>i(n,r)).filter(n=>n!==""&&!o.has(n))}function u(e,r){return e[0]!==r.key?e:!s(r).includes(r.key)||e.length>t(r)?e.slice(1):e}function c(e,r){return u(e,r).slice(0,t(r))}function a(e,r){const n=c(e,r);return n.length===t(r)?n:null}export{c as irrHeardForms,a as irrSpokenAnswer,p as irrSpokenWords};

//# sourceMappingURL=parseSpokenIrregular.js.map
