// Version de l'app, source unique. Le `?? 'dev'` n'est pas décoratif : la
// variable est injectée par le build, donc absente en dev et sous vitest, où
// `import.meta.env.VITE_APP_VERSION` vaut `undefined` malgré son type `string`
// (cf. src/env.d.ts). Trois sites la lisaient chacun de leur côté, dont un sans
// repli — il affichait « vundefined » hors production.
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? 'dev';
