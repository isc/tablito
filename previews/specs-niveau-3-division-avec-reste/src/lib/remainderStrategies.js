import{remainderDividend as o}from"../types.js";import{getRemainderStrategyText as d}from"../i18n/strategies.js";function s(e){const{divisor:r,quotient:n}=e.fact,i=o(e),t=d();return{title:t.title,intro:t.intro(i,r),divisor:r,dividend:i,quotient:n,remainder:e.remainder,conclusion:t.conclusion(i,r,n,e.remainder)}}export{s as getRemainderStrategy};

//# sourceMappingURL=remainderStrategies.js.map
