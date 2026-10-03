import{addDays as l}from"./utils.js";const d=14;function D(o,s){const e=new Set,i=new Set;let a=null;for(const t of o.sessionHistory)t.kind==="conj"?(i.add(t.date),a??=t.date):e.add(t.date);const c=a??o.lastConjSessionDate??s,r=[];for(let t=d-1;t>=0;t--){const n=l(s,-t);r.push({date:n,math:e.has(n),conj:n<c?null:i.has(n)})}return r}export{d as ACTIVITY_WINDOW_DAYS,D as buildActivityDays};

//# sourceMappingURL=activity.js.map
