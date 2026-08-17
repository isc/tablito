let t=null;function e(){return(!t||t.state==="closed")&&(t=new AudioContext),t.state==="suspended"&&t.resume(),t}export{e as getAudioContext};

//# sourceMappingURL=audioContext.js.map
