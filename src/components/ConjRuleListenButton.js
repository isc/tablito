import{jsx as l}from"preact/jsx-runtime";import o from"./ListenButton.js";import{conjStrings as e}from"../i18n/conjugation.js";import{conjRuleTtsKey as r}from"../lib/conjugationRules.js";function i({rule:t,onSpeak:n}){return l(o,{className:"conj-rule-listen-btn",label:e.listenRule,onClick:()=>n(r(t))})}export{i as default};

//# sourceMappingURL=ConjRuleListenButton.js.map
