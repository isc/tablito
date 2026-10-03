import{addDays as u}from"./utils.js";const y=14;function m(e,s){const r=new Set,o=new Set,i=new Set;let a=null,l=null;for(const t of e.sessionHistory)t.kind==="conj"?(o.add(t.date),a??=t.date):t.kind==="irr"?(i.add(t.date),l??=t.date):r.add(t.date);const d=a??e.lastConjSessionDate??s,D=l??e.lastIrrSessionDate??s,c=[];for(let t=y-1;t>=0;t--){const n=u(s,-t);c.push({date:n,math:r.has(n),conj:n<d?null:o.has(n),irr:n<D?null:i.has(n)})}return c}export{y as ACTIVITY_WINDOW_DAYS,m as buildActivityDays};

//# sourceMappingURL=activity.js.map
