import{getFactKey as n}from"./facts.js";function r(i,t){return`${i}/${t}`}function s(){const i=[];for(let t=2;t<=9;t++)for(let e=2;e<=9;e++)i.push({dividend:t*e,divisor:t,quotient:e,box:1,lastSeen:"",nextDue:"",history:[],introduced:!1});return i}function a(i){return n(i.divisor,i.quotient)}export{s as createInitialDivisionFacts,r as getDivisionFactKey,a as parentMultiplicationKey};

//# sourceMappingURL=divisionFacts.js.map
