import{LAST_SESSION_DATE_FIELD as c}from"./hardestFacts.js";import{daysBetween as i}from"./utils.js";const S=2;function d(n,o,u){const r=o.flatMap(({subject:t,available:s})=>{const a=n[c[t]];return a?[{subject:t,available:s,days:i(a,u)}]:[]});if(r.length<2)return null;const[e,l]=r.filter(t=>t.available).sort((t,s)=>s.days-t.days);return!e||e.days<S||l?.days===e.days?null:{subject:e.subject,days:e.days}}export{d as suggestSubject};

//# sourceMappingURL=subjectSuggestion.js.map
