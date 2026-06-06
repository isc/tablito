import{jsx as t,jsxs as r}from"preact/jsx-runtime";import a from"./StrategyHintShell.js";function o({strategy:i,variant:n="feedback"}){const e=r("span",{className:"strategy-hint-pivot",children:[i.divisor," \xD7 ",t("span",{className:"strategy-hint-box","aria-label":"le nombre \xE0 trouver",children:"?"})," ="," ",i.dividend]});return t(a,{variant:n,title:i.title,lines:[i.intro,e,i.conclusion],eyebrow:"L'astuce"})}export{o as default};

//# sourceMappingURL=DivisionStrategyHint.js.map
