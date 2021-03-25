"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// Queue data structure
var Queue =
/*#__PURE__*/
function () {
  // Instantiate array
  function Queue() {
    _classCallCheck(this, Queue);

    this.elements = [];
  } // Add to queue


  _createClass(Queue, [{
    key: "enqueue",
    value: function enqueue(element) {
      this.elements.push(element);
    } // Remove from queue

  }, {
    key: "dequeue",
    value: function dequeue() {
      return this.elements.shift();
    } // Return next element to be removed

  }, {
    key: "peek",
    value: function peek() {
      if (this.isEmpty()) {
        return undefined;
      } else {
        return this.elements[0];
      }
    }
  }, {
    key: "isEmpty",
    value: function isEmpty() {
      return this.elements.length == 0;
    }
  }, {
    key: "length",
    value: function length() {
      return this.elements.length;
    }
  }]);

  return Queue;
}();

module.exports = Queue;