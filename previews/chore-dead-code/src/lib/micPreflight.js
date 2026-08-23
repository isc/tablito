async function a(){if(navigator.mediaDevices?.getUserMedia)try{(await navigator.mediaDevices.getUserMedia({audio:!0})).getTracks().forEach(e=>e.stop())}catch{}}export{a as preflightMicPermission};

//# sourceMappingURL=micPreflight.js.map
