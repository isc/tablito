import{jsx as t}from"preact/jsx-runtime";import{useParentDashboardStrings as n}from"../i18n/parent.js";const m=["mastered","onTrack","fragile"];function o({buckets:e,total:r}){const s=n();return t("span",{className:"parent-mastery-bar",role:"img","aria-label":s.masteryBarLabel(e.mastered,r),children:m.map(a=>t("span",{className:`parent-mastery-seg parent-mastery-seg--${a}`,style:{width:`${e[a]/Math.max(r,1)*100}%`}},a))})}export{o as default};

//# sourceMappingURL=ParentMastery.js.map
