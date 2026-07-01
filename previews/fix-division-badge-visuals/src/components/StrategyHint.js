import{jsx as a}from"preact/jsx-runtime";import o from"./StrategyHintShell.js";import{useStrategyHintStrings as i}from"../i18n/strategies.js";const r={"near-ten":"\xD79","skip-count":"\xD75","double-add":"\xD73","double-double":"\xD74","five-plus-one":"\xD76","five-plus-two":"\xD77","double-double-double":"\xD78"};function l({strategy:e,variant:t="feedback"}){const n=i();return a(o,{variant:t,title:e.title,lines:e.lines,eyebrow:n.eyebrowMult(r[e.kind]),recall:t==="intro"&&e.kind==="near-ten"?n.tenRecall:void 0})}export{l as default};

//# sourceMappingURL=StrategyHint.js.map
