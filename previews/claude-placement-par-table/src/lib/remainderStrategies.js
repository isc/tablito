import{remainderDividend as o}from"../types.js";import{getRemainderStrategyText as d}from"../i18n/strategies.js";function c(e){const{divisor:r,quotient:n}=e.fact,t=o(e),i=d();return{title:i.title,intro:i.intro(t,r),divisor:r,dividend:t,quotient:n,remainder:e.remainder,conclusion:i.conclusion(t,r,n,e.remainder)}}export{c as getRemainderStrategy};

//# sourceMappingURL=remainderStrategies.js.map
