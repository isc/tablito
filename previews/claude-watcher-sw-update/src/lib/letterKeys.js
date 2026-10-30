const E=["a","b","c","d","e","\xE9","\xEA","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"],T=7;function L(n,r){const o=E.indexOf(n),t=E.indexOf(r);if(o===-1||t===-1)return!1;const s=Math.abs(Math.floor(o/7)-Math.floor(t/7)),e=Math.abs(o%7-t%7);return s+e===1}export{E as LETTER_KEYS,T as LETTER_KEY_COLUMNS,L as areNeighborKeys};

//# sourceMappingURL=letterKeys.js.map
