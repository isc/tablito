import{addDays as d}from"./utils.js";import{LAST_SESSION_DATE_FIELD as m,subjectOf as u}from"./hardestFacts.js";const y=14;function f(e,n){const r={math:new Set,conj:new Set,irr:new Set},s={};for(const t of e.sessionHistory){const o=u(t);r[o].add(t.date),s[o]??=t.date}const i=t=>s[t]??e[m[t]]??n,a=i("conj"),l=i("irr"),c=[];for(let t=y-1;t>=0;t--){const o=d(n,-t);c.push({date:o,math:r.math.has(o),conj:o<a?null:r.conj.has(o),irr:o<l?null:r.irr.has(o)})}return c}export{y as ACTIVITY_WINDOW_DAYS,f as buildActivityDays};

//# sourceMappingURL=activity.js.map
