import{jsx as n,jsxs as l}from"preact/jsx-runtime";import r from"./StrategyHintShell.js";import{useStrategyHintStrings as a}from"../i18n/strategies.js";function s({strategy:i,variant:e="feedback"}){const t=a(),o=l("span",{className:"strategy-hint-pivot",children:[i.divisor," \xD7 ",n("span",{className:"strategy-hint-box","aria-label":t.missingFactorAria,children:"?"})," ="," ",i.dividend]});return n(r,{variant:e,title:i.title,lines:[i.intro,o,i.conclusion],eyebrow:t.eyebrowDiv})}export{s as default};

//# sourceMappingURL=DivisionStrategyHint.js.map
