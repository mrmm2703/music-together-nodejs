"use strict";function _classCallCheck(e,t){if(!(e instanceof t))throw new TypeError("Cannot call a class as a function")}function _defineProperties(e,t){for(var n=0;n<t.length;n++){var r=t[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(e,r.key,r)}}function _createClass(e,t,n){return t&&_defineProperties(e.prototype,t),n&&_defineProperties(e,n),e}var Queue=function(){function e(){_classCallCheck(this,e),this.elements=[]}return _createClass(e,[{key:"enqueue",value:function(e){this.elements.push(e)}},{key:"dequeue",value:function(){return this.elements.shift()}},{key:"peek",value:function(){return this.isEmpty()?void 0:this.elements[0]}},{key:"isEmpty",value:function(){return 0==this.elements.length}},{key:"length",value:function(){return this.elements.length}}]),e}();module.exports=Queue;