import{remainderDividend as i}from"../types.js";function t(r){return r.kind==="rem"?{left:i(r),op:"\xF7",right:r.fact.divisor}:r.kind==="div"?{left:r.fact.dividend,op:"\xF7",right:r.fact.divisor}:{left:r.displayA,op:"\xD7",right:r.displayB}}export{t as itemDisplay};

//# sourceMappingURL=sessionItemView.js.map
