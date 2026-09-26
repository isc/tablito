function e(){const n="https://cseyzitvqvyuabmenntb.supabase.co",t="sb_publishable_WKCgKA1DIyj8o1eG4_Pciw_ZoujAiqj";return n&&t?{url:n,key:t}:null}function s(n){return{apikey:n,Authorization:`Bearer ${n}`,"Content-Type":"application/json"}}async function o(n,t){const r=e();if(!r)return null;try{return await fetch(`${r.url}/rest/v1/rpc/${n}`,{method:"POST",headers:s(r.key),body:JSON.stringify(t)})}catch{return null}}export{e as supabaseEnv,s as supabaseHeaders,o as supabaseRpc};

//# sourceMappingURL=supabase.js.map
