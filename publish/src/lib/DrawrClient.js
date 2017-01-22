'use strict';

/* msg schema
    Message {
        status,
        type,
        data
    }
*/

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _eventemitter = require('eventemitter3');

var _eventemitter2 = _interopRequireDefault(_eventemitter);

var _xhr = require('xhr');

var _xhr2 = _interopRequireDefault(_xhr);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * error handling if websocket fails to connect
 * @private
 * @returns {void}
 */
function onWebSocketError() {
    console.log('error connecting to ws server');
}

/**
 * emit event when websocket connection is open
 * @private
 * @returns {void}
 */
function onWebSocketOpen() {
    console.log('connected to websocket server');
}

/**
 * handle wedsocket messages from server
 * @private
 * @param {Object} event - websocket event data
 * @returns {void}
 */
function onWebSocketMessage(event) {
    var msg = JSON.parse(event.data);
    if (msg.type === 'new-user') {
        this._eventEmitter.emit('new-user', msg.data);
    } else if (msg.type === 'update-canvas') {
        this._eventEmitter.emit('update-canvas', msg.data);
    }
}

/**
 * util function to generate url
 * @private
 * @param {String} protocol - http or ws
 * @param {String} endPoint - which endpoint to request
 * @returns {String} url - concatenated url
 */
function makeUrl(protocol, endPoint) {
    return protocol + '://' + this._options.host + ':' + this._options.port + endPoint;
}

var DrawrClient = function () {
    /**
    * @typedef {Object} User
    * @property {String} name
    */

    /**
    * creates a new server connection instance
    * @constructor
    * @param {User} user - user to connect to server
    * @param {Object} options - websocket/http server host and port
    */
    function DrawrClient(user, options) {
        _classCallCheck(this, DrawrClient);

        this._user = user;
        this._options = options;
        this._eventEmitter = new _eventemitter2.default();
        this._wsClient = null;
        this._session = {};
    }
    /* Private methods */

    /**
    * @typedef {Object} SessionData
    * @property {String} sessionId
    * @property {Array} users
    */

    /**
    * set session data
    * @private
    * @returns {Promise} p - successfull if websocket connects
    */


    _createClass(DrawrClient, [{
        key: '_connectToSession',
        value: function _connectToSession() {
            var _this = this;

            var p = new Promise(function (resolve, reject) {
                try {
                    _this._wsClient = new WebSocket(makeUrl.call(_this, 'ws', '/session/' + _this._session.id + '/ws'));
                    _this._wsClient.onopen = onWebSocketOpen.bind(_this);
                    _this._wsClient.onmessage = onWebSocketMessage.bind(_this);
                    _this._wsClient.onerror = onWebSocketError.bind(_this);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
            return p;
        }

        /* Public API */

        /**
        * add listener to server event
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
        * join an existing session via session id
        * @param {String} sessionId - id of the session to join
        * @returns {Promise} p - resolve/rejects after http request result
        */

    }, {
        key: 'joinSession',
        value: function joinSession(sessionId) {
            var _this2 = this;

            var options = {
                url: makeUrl.call(this, 'http', '/session/' + sessionId)
            };
            var p = new Promise(function (resolve, reject) {
                (0, _xhr2.default)(options, function (err, response, body) {
                    if (err) {
                        reject(response);
                    }
                    if (response.statusCode === 200) {
                        _this2._session = JSON.parse(body);
                        _this2._connectToSession().then(resolve).catch(reject);
                    } else {
                        reject(response);
                    }
                });
            });
            return p;
        }

        /**
        * creates a new session with given name
        * @param {String} name - session name
        * @returns {Promise} p - resolve/rejects after http request result
        */

    }, {
        key: 'newSession',
        value: function newSession() {
            var _this3 = this;

            var name = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';

            var options = {
                url: makeUrl.call(this, 'http', '/session/new?name=' + name)
            };
            var p = new Promise(function (resolve, reject) {
                (0, _xhr2.default)(options, function (err, response, body) {
                    if (err) {
                        reject(response);
                    }
                    if (response.statusCode === 200) {
                        _this3._session = JSON.parse(body);
                        _this3._connectToSession().then(resolve(_this3.getSessionId())).catch(reject);
                    } else {
                        reject(response);
                    }
                });
            });
            return p;
        }

        /**
        * get session ID from connected session
        * @returns {String} sessionId
        */

    }, {
        key: 'getSessionId',
        value: function getSessionId() {
            return this._session.id;
        }

        /**
        * get connected users from session
        * @returns {Array} usersList - array with all users connected to session
        */

    }, {
        key: 'getUsersList',
        value: function getUsersList() {
            return this._session.users;
        }

        /**
        * send canvas click updates to websocket connection
        * @param {Array} clicks - new clicks to send
        * @returns {void}
        */

    }, {
        key: 'sendCanvasUpdate',
        value: function sendCanvasUpdate(clicks) {
            if (this._wsClient.readyState === this._wsClient.OPEN) {
                if (this._pendingUpdates.length > 0) {
                    var combinedClicks = this._pendingUpdates.pop().concat(clicks);
                    this._wsClient.send(JSON.stringify({
                        type: 'update-canvas',
                        data: {
                            username: this._user.name,
                            sessionId: '',
                            canvasState: JSON.stringify(combinedClicks)
                        }
                    }));
                } else {
                    this._wsClient.send(JSON.stringify({
                        type: 'update-canvas',
                        data: {
                            username: this._user.name,
                            sessionId: '',
                            canvasState: JSON.stringify(clicks)
                        }
                    }));
                }
            } else {
                this._pendingUpdates.unshift(clicks);
            }
        }
    }]);

    return DrawrClient;
}();

exports.default = DrawrClient;