const t="multiplix-skip-install";function e(){return typeof window>"u"?!1:window.matchMedia?.("(display-mode: standalone)").matches?!0:window.navigator.standalone===!0}function a(){if(typeof navigator>"u")return!1;const n=navigator.userAgent;return/iPhone|iPod/.test(n)||/iPad/.test(n)?!0:navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1}function o(){return typeof navigator>"u"?!1:/Android/i.test(navigator.userAgent)}function r(){try{localStorage.removeItem(t)}catch{}}export{r as clearInstallSkipped,o as isAndroid,a as isIOS,e as isStandalone};

//# sourceMappingURL=install.js.map
