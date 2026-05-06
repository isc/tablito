import{daysBetween as r}from"./utils.js";function n(e,t){return e.lastSessionDate&&r(e.lastSessionDate,t)<=1?e.currentStreak:0}export{n as getActiveStreak};

//# sourceMappingURL=streak.js.map
