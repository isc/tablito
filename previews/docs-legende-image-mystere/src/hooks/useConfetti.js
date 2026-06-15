import{useCallback as m}from"react";const a=["#6C63FF","#FF6B6B","#4ECDC4","#FFE66D","#FF8A5C","#A8E6CF","#F8B500"],p=40,f=2e3;function C(){return{triggerConfetti:m(()=>{const e=document.createElement("div");e.style.cssText=`
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: hidden;
    `,document.body.appendChild(e);const o="multiplix-confetti-style";if(!document.getElementById(o)){const t=document.createElement("style");t.id=o,t.textContent=`
        @keyframes multiplix-confetti-fall {
          0% {
            transform: translateY(-10px) rotate(0deg) scale(1);
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg) scale(0.3);
            opacity: 0;
          }
        }
      `,document.head.appendChild(t)}for(let t=0;t<p;t++){const n=document.createElement("div"),s=a[Math.floor(Math.random()*a.length)],i=6+Math.random()*8,r=Math.random()*100,l=Math.random()*.5,c=1.2+Math.random()*1,d=Math.random()>.5;n.style.cssText=`
        position: absolute;
        top: -10px;
        left: ${r}%;
        width: ${i}px;
        height: ${i}px;
        background-color: ${s};
        border-radius: ${d?"50%":"2px"};
        animation: multiplix-confetti-fall ${c}s ease-in ${l}s forwards;
      `,e.appendChild(n)}setTimeout(()=>{e.remove()},f)},[])}}export{C as useConfetti};

//# sourceMappingURL=useConfetti.js.map
