import{jsx as r}from"preact/jsx-runtime";import{StrictMode as o}from"react";import{createRoot as t}from"react-dom/client";import{registerSW as m}from"virtual:pwa-register";import i from"./App.js";import e from"./components/ErrorBoundary.js";import{importProfileFromUrl as f}from"./lib/storage.js";async function p(){await f(),m(),t(document.getElementById("root")).render(r(o,{children:r(e,{children:r(i,{})})}))}p();

//# sourceMappingURL=main.js.map
