import{getDivisionStrategyText as r}from"../i18n/strategies.js";function c(t){const{dividend:i,divisor:n,quotient:e}=t,o=r();return{title:o.title,intro:o.intro(i,n),divisor:n,dividend:i,quotient:e,conclusion:o.conclusion(i,n,e)}}function u(t,i){return i===t.dividend*t.divisor}export{c as getDivisionStrategy,u as isMultiplicationSlip};

//# sourceMappingURL=divisionStrategies.js.map
