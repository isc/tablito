import{jsx as n}from"preact/jsx-runtime";import{useLang as l,SUPPORTED_LANGS as g}from"../i18n/lang.js";import{useLanguageStrings as r}from"../i18n/language.js";import i from"./ParentSegmented.js";import{SettingRow as m}from"./ParentSettingRow.js";import{GlobeIcon as s}from"./ParentSettingIcons.js";const L={fr:"Fran\xE7ais",en:"English"};function p(){const{lang:t,setLang:a}=l(),e=r();return n(m,{icon:n(s,{}),title:e.label,trailing:n(i,{pill:!0,label:e.label,value:t,onChange:a,options:g.map(o=>({value:o,label:L[o]}))})})}export{p as default};

//# sourceMappingURL=LanguageToggle.js.map
