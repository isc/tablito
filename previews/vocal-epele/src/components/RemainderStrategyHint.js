import{jsx as i,jsxs as d}from"preact/jsx-runtime";import a from"./StrategyHintShell.js";import{useStrategyHintStrings as o}from"../i18n/strategies.js";function s({strategy:t,variant:r="feedback"}){const e=o(),n=d("span",{className:"strategy-hint-pivot",children:[t.divisor," \xD7 ",i("span",{className:"strategy-hint-box","aria-label":e.missingFactorAria,children:"?"})," ","\u2264"," ",t.dividend]});return i(a,{variant:r,title:t.title,lines:[t.intro,n,t.conclusion],eyebrow:e.eyebrowDiv})}export{s as default};

//# sourceMappingURL=RemainderStrategyHint.js.map
