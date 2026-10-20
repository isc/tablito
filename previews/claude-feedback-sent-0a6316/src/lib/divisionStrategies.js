import{getDivisionStrategyText as r}from"../i18n/strategies.js";function d(t){const{dividend:i,divisor:n,quotient:e}=t,o=r();return{title:o.title,intro:o.intro(i,n),divisor:n,dividend:i,quotient:e,conclusion:o.conclusion(i,n,e)}}function c(t,i){return i===t.dividend*t.divisor}export{d as getDivisionStrategy,c as isMultiplicationSlip};

//# sourceMappingURL=divisionStrategies.js.map
