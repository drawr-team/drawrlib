'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var mouseX = void 0;
var mouseY = void 0;
var oldmouseX = 0;
var oldmouseY = 0;

var DRAWING_TOOLS = {
    PEN: 'pen',
    ERASER: 'eraser'
};

var STANDARD_OPTIONS = {
    colour: '#000000',
    width: 10,
    type: DRAWING_TOOLS.PEN
};

/**
 * listener to click on canvas
 * @private
 * @param {Object} e - event data
 * @returns {void}
 */
function mousedownListener(e) {
    this._timeDragging = window.performance.now();
    var mouseX = e.pageX - this._canvas.offsetLeft;
    var mouseY = e.pageY - this._canvas.offsetTop;

    this._paint = true;
    // click will start on next index
    // save to be able to undo
    this._clickStarts.push(this._lastDraw + 1);
    this._addClick(mouseX, mouseY, false);
}

/**
 * listener to move on canvas
 * @private
 * @param {Object} e - event data
 * @returns {void}
 */
function mousemoveListener(e) {
    var drawingAreaX = this._width;
    var drawingAreaY = this._height;
    var drawingAreaWidth = 10;

    mouseX = (e.changedTouches ? e.changedTouches[0].pageX : e.pageX) - this._canvas.offsetLeft;
    mouseY = (e.changedTouches ? e.changedTouches[0].pageY : e.pageY) - this._canvas.offsetTop;
    if (mouseX < drawingAreaX && mouseY < drawingAreaY) {
        if (mouseX > drawingAreaWidth && mouseY > 0) {
            if (this._paint) {
                this._addClick(mouseX, mouseY, true);
                var t = window.performance.now();
                if (t - this._timeDragging > 2000) {
                    this._wrapAndEmitClicks();
                    this._timeDragging = t;
                }
            }
        }
    } else {
        if (this._paint) {
            this._addClick(mouseX, mouseY, false);
            var _t = window.performance.now();
            if (_t - this._timeDragging > 2000) {
                this._wrapAndEmitClicks();
                this._timeDragging = _t;
            }
        }
    }
    // Prevent the whole page from dragging if on mobile
    e.preventDefault();
}

/**
 * listener to finishing draw on canvas
 * @private
 * @returns {void}
 */
function mouseupListener() {
    this._paint = false;
    this._wrapAndEmitClicks();
}

/**
 * set click listeners on canvas
 * @private
 * @returns {void}
 */
function setEventListeners() {
    this._canvas.addEventListener('mousedown', mousedownListener.bind(this), false);
    this._canvas.addEventListener('mouseup', mouseupListener.bind(this), false);
    this._canvas.addEventListener('mousemove', mousemoveListener.bind(this), false);
    this._canvas.addEventListener('touchstart', mousedownListener.bind(this), false);
    this._canvas.addEventListener('touchmove', mousemoveListener.bind(this), false);
    this._canvas.addEventListener('touchend', mouseupListener.bind(this), false);
}

var DrawrCanvas = function () {
    /**
    * creates a new canvas
    * @constructor
    * @param {String} divId - div where canvas should be created
    * @param {Object} options - styling options for the canvas
    * @returns {void}
    */
    function DrawrCanvas(divId, options) {
        var _this = this;

        _classCallCheck(this, DrawrCanvas);

        this._stylingOptions = Object.assign({}, STANDARD_OPTIONS, options);
        this._canvasDiv = document.getElementById(divId);
        this._canvas = document.createElement('canvas');
        this._canvas.setAttribute('class', 'DrawrCanvas');
        // hack so that elements can be fully loaded to get attributes
        setTimeout(function () {
            _this._width = _this._canvasDiv.clientWidth;
            _this._height = _this._canvasDiv.clientHeight;
            _this._canvas.setAttribute('width', _this._width);
            _this._canvas.setAttribute('height', _this._height);
        }, 0);
        this._canvasDiv.appendChild(this._canvas);
        this._paint = false;
        setEventListeners.apply(this);
        this._context = this._canvas.getContext('2d');
        this._eventEmitter = new _eventemitter2.default();
        // save original context for transformations
        this._context.save();
        this._clicks = [];
        this._zoom = 0;
        this._scaleX = 1;
        this._scaleY = 1;
        this._lastDraw = 0;
        this._clickStarts = [];
        this._redoClicks = [];
    }

    /**
    * add and draw changes to canvas
    * @private
    * @param {Number} x - x coordinate
    * @param {Number} y - y coordinate
    * @param {Boolean} dragging - if point should be connected to last one
    * @returns {void}
    */


    _createClass(DrawrCanvas, [{
        key: '_addClick',
        value: function _addClick(x, y, dragging) {
            this._clicks.push({
                x: x / this._scaleX - oldmouseX,
                y: y / this._scaleY - oldmouseY,
                drag: dragging,
                style: Object.assign({}, this._stylingOptions),
                remote: false
            });
            this._redraw();
        }

        /**
        * get index of last click made by local user
        * @private
        * @param {Number} index - index from where to start looking
        * @return {Number} index - last local index from given click
        */

    }, {
        key: '_getLastLocalClick',
        value: function _getLastLocalClick(index) {
            for (var i = index; i >= 0; i--) {
                if (!this._clicks[i].remote) {
                    return i;
                }
            }
        }

        /**
        * add clicks coming from server
        * @private
        * @param {Boolean} hard - if true, clears and rescale canvas, and redraws all clicks
        * @returns {void}
        */

    }, {
        key: '_redraw',
        value: function _redraw() {
            var hard = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;

            this._context.lineJoin = 'round';
            if (hard) {
                this.clearCanvas(false);
            }
            for (var i = this._lastDraw; i < this._clicks.length; i++) {
                this._context.beginPath();
                this._context.strokeStyle = this._clicks[i].style.colour;
                if (this._clicks[i].drag && i && !this._clicks[i].pathStart) {
                    if (this._clicks[i].remote) {
                        this._context.moveTo(this._clicks[i - 1].x, this._clicks[i - 1].y);
                    } else {
                        // remote clicks might be rendered while user is dragging
                        // if this is the case, point should be connected to last local click, not a remote one
                        var lastLocalClick = this._getLastLocalClick(i - 1);
                        if (lastLocalClick) {
                            this._context.moveTo(this._clicks[lastLocalClick].x, this._clicks[lastLocalClick].y);
                        }
                    }
                } else {
                    this._context.moveTo(this._clicks[i].x - 1, this._clicks[i].y);
                }
                this._context.lineTo(this._clicks[i].x, this._clicks[i].y);
                this._context.closePath();
                this._context.lineWidth = this._clicks[i].style.colour;
                this._context.stroke();
            }
            this._lastDraw = this._clicks.length > 0 ? this._clicks.length - 1 : 0;
        }
    }, {
        key: '_wrapAndEmitClicks',
        value: function _wrapAndEmitClicks() {
            var clicks = [];
            var totalLength = this._clicks.length - 1;
            // add last click
            var clickCp = Object.assign({}, this._clicks[totalLength], { remote: true });
            clicks.push(clickCp);
            if (clicks[0].drag) {
                // add all dragging clicks
                var lastLocalClick = this._getLastLocalClick(totalLength - 1);
                while (this._clicks[lastLocalClick].drag && lastLocalClick) {
                    var _clickCp = Object.assign({}, this._clicks[lastLocalClick], { remote: true });
                    clicks.unshift(_clickCp);
                    lastLocalClick = this._getLastLocalClick(lastLocalClick - 1);
                }
            }
            clicks[0].pathStart = true;
            this._eventEmitter.emit('new-click', clicks);
        }

        /**
        * clear all clicks from canvas
        * @param {Boolean} removeClicks - if clear is just for rescaling and redraw, set to false to don't remove made clicks
        * @returns {void}
        */

    }, {
        key: 'clearCanvas',
        value: function clearCanvas() {
            var removeClicks = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : true;

            // restore original context to clear full canvas
            this._context.restore();
            this._context.clearRect(0, 0, this._width, this._height);
            // save it again for transformations
            this._context.save();
            var xTranslation = mouseX;
            var yTranslation = mouseY;
            oldmouseX = mouseX;
            oldmouseY = mouseY;

            this._context.translate(xTranslation, yTranslation);
            this._context.scale(this._scaleX, this._scaleY);
            this._context.translate(-xTranslation, -yTranslation);
            this._lastDraw = 0;
            if (removeClicks) {
                this._clicks = [];
                this._zoom = 0;
                this._scaleX = 1;
                this._scaleY = 1;
            }
        }

        /**
        * add image to canvas at given coordinates
        * @param {Object} img - image to be draw
        * @param {Number} x - x coordinate
        * @param {Number} y - y coordinate
        * @returns {void}
        */

    }, {
        key: 'addImage',
        value: function addImage(img, x, y) {
            this._context.drawImage(img, 0, 0, 100, 100, x, y, this._scaleX, this._scaleY);
        }

        /**
        * add clicks coming from server
        * @param {Object} clicks - clicks coming from server
        * @returns {void}
        */

    }, {
        key: 'remoteUpdate',
        value: function remoteUpdate(clicks) {
            this._clickStarts.push(this._lastDraw + 1);
            this._clicks = this._clicks.concat(clicks);
            this._redraw();
        }

        /**
        * updates styling options
        * @param {Object} options - new option to be set
        * @returns {void}
        */

    }, {
        key: 'updateOptions',
        value: function updateOptions(options) {
            if (options.type === DRAWING_TOOLS.ERASER) {
                options.colour = '#FFFFFF';
            }
            Object.assign(this._stylingOptions, options);
        }

        /**
        * set new zoom level and calls redraw
        * @param {Number} zoom - new zoom level
        * @returns {void}
        */

    }, {
        key: 'setZoom',
        value: function setZoom(zoom) {
            if (isNaN(zoom) || zoom < 0) {
                throw new TypeError('zoom must be an integer equal or bigger than zero');
            }
            this._zoom = zoom;
            this._scaleX = 1 - this._zoom * 0.1;
            this._scaleY = 1 - this._zoom * 0.1;
            this._redraw(true);
        }

        /**
        * add listener to canvas event
        * @param {String} name - event name
        * @param {Function} listener - function to be executed on event
        * @param {Context} context - context (this value) to execute listener
        * @returns {void}
        */

    }, {
        key: 'addEventListener',
        value: function addEventListener(name, listener, context) {
            if (typeof name !== 'string') {
                throw new TypeError('event name must be a string');
            }
            if (typeof listener !== 'function') {
                throw new TypeError('listener must be a function');
            }
            this._eventEmitter.on(name, listener, context);
        }

        /**
        * undo last click
        * @returns {void}
        */

    }, {
        key: 'undoLastClick',
        value: function undoLastClick() {
            if (this._clickStarts.length > 0) {
                var initialIndex = this._clickStarts.pop();
                if (initialIndex) {
                    this._redoClicks.push(this._clicks.splice(initialIndex, this._clicks.length - initialIndex));
                    this._redraw(true);
                }
            }
        }

        /**
        * redo last click
        * @returns {void}
        */

    }, {
        key: 'redoLastClick',
        value: function redoLastClick() {
            if (this._redoClicks.length > 0) {
                this._clicks = this._clicks.concat(this._redoClicks.pop());
                this._redraw(true);
            }
        }

        /**
        * gets all clicks drawn on canvas
        * @return {Array} clicks - all clicks on canvas instance
        */

    }, {
        key: 'getAllClicks',
        value: function getAllClicks() {
            return this._clicks.slice();
        }

        /**
        * @prop {String} PEN - pen-like drawing
        * @prop {String} ERASER - eraser
        */

    }], [{
        key: 'drawingTools',
        get: function get() {
            return DRAWING_TOOLS;
        }
    }]);

    return DrawrCanvas;
}();

exports.default = DrawrCanvas;