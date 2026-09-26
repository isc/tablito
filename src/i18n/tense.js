const n={fr:{present:"pr\xE9sent",imparfait:"imparfait",futur:"futur"},en:{present:"present",imparfait:"imperfect",futur:"future"}};function f(t,e=""){const r=n.fr[t];return/^[aeiouyéèê]/i.test(r)?`${e?`${e} `:""}l\u2019${r}`:`${{"":"le",\u00E0:"au",de:"du"}[e]} ${r}`}export{n as TENSE_NAMES,f as tenseFr};

//# sourceMappingURL=tense.js.map
