import * as MQTTPattern from "mqtt-pattern";
import mqtt from "mqtt";
var connectionParameters = /** @class */ (function () {
    function connectionParameters(protocol, username, password, host, port) {
        this.protocol = protocol;
        this.username = username;
        this.password = password;
        this.host = host;
        this.port = port;
    }
    return connectionParameters;
}());
var easymqtt = new /** @class */ (function () {
    function class_1() {
        this.handlers = [];
        this.initialized = false;
    }
    Object.defineProperty(class_1.prototype, "client", {
        get: function () {
            return this._client;
        },
        enumerable: false,
        configurable: true
    });
    class_1.prototype.onMessage = function (topic, payload) {
        this.handlers.forEach(function (handler) {
            if (MQTTPattern.matches(handler.pattern, topic)) {
                var params = MQTTPattern.exec(handler.pattern, topic);
                handler.handle(params, payload);
            }
        });
    };
    class_1.prototype.parseConnectionUrl = function (urlString) {
        try {
            var urlRegex = /^(\w+):\/\/(?:([^:@]+)(?::([^:@]+))?@)?([^:@]+):(\d+)$/;
            var match = urlRegex.exec(urlString);
            if (!match) {
                throw new Error("Invalid connection URL: ".concat(urlString, "\nExpected format: protocol://username:password@host:port"));
            }
            var protocol = match[1];
            var username = match[2];
            var password = match[3];
            var host = match[4];
            var port = parseInt(match[5]);
            var connection = new connectionParameters(protocol, username, password, host, port);
            return connection;
        }
        catch (err) {
            console.error(err);
            throw new Error(err);
        }
    };
    class_1.prototype.connect = function (options) {
        var _this = this;
        if (this.initialized) {
            return;
        }
        if (options.url) {
            var connection = this.parseConnectionUrl(options.url);
            options.protocol = connection.protocol;
            options.username = connection.username;
            options.password = connection.password;
            options.host = connection.host;
            options.port = connection.port;
        }
        this._client = mqtt.connect(options);
        this.client.on('connect', function () {
            console.debug('connected to mqtt broker');
        });
        this.client.on("message", function (topic, payload) { return _this.onMessage(topic, payload); });
        this.client.on('error', function (err) {
            console.error(err);
            _this.client.end();
        });
        this.initialized = true;
    };
    class_1.prototype.publish = function (topic, message) {
        //check message type
        if (typeof message === "string") {
            message = Buffer.from(message);
        }
        this.client.publish(topic, message);
    };
    class_1.prototype.rpc = function (rpcRequest) {
        var _this = this;
        var timeout = rpcRequest.timeout || 5000;
        return new Promise(function (resolve, reject) {
            var responseHandler = {
                pattern: rpcRequest.response,
                handle: function (params, msg) {
                    clear();
                    resolve({ params: params, payload: msg });
                }
            };
            var rejectHandler = rpcRequest.error ? {
                pattern: rpcRequest.error,
                handle: function (params, msg) {
                    clear();
                    reject({ params: params, msg: msg });
                }
            } : null;
            var unsubscribe = function () {
                _this.removeHandler(responseHandler);
                if (rejectHandler) {
                    _this.removeHandler(rejectHandler);
                }
            };
            var timeoutHandler = setTimeout(function () {
                unsubscribe();
                reject({ params: {}, msg: "timeout" });
            }, timeout);
            var clear = function () {
                unsubscribe();
                clearTimeout(timeoutHandler);
            };
            _this.addHandler(responseHandler);
            if (rejectHandler) {
                _this.addHandler(rejectHandler);
            }
            _this.publish(MQTTPattern.clean(rpcRequest.request), rpcRequest.message);
        });
    };
    class_1.prototype.on = function (pattern, method) {
        this.addHandler({
            pattern: pattern,
            handle: function (params, payload) { return method(params, payload); }
        });
    };
    class_1.prototype.addHandler = function (handler) {
        var _this = this;
        var topic = MQTTPattern.clean(handler.pattern);
        //check if handler already exists
        if (this.handlers.find(function (e) { return e.pattern === handler.pattern; })) {
            throw new Error("handler already exists");
        }
        this.client.subscribe(topic, function (err) {
            if (err) {
                console.error(err);
            }
            console.debug("subscribed to ".concat(topic));
            _this.handlers.push(handler);
        });
        return handler;
    };
    class_1.prototype.removeHandler = function (handler) {
        var _this = this;
        var topic = MQTTPattern.clean(handler.pattern);
        //check if handler exists
        if (!this.handlers.find(function (e) { return e.pattern === handler.pattern; })) {
            return;
        }
        this.client.unsubscribe(topic, function (err) {
            if (err) {
                console.error(err);
            }
            console.debug("unsubscribed from ".concat(topic));
            _this.handlers = _this.handlers.filter(function (e) { return e.pattern !== handler.pattern; });
        });
    };
    return class_1;
}());
export { easymqtt };
export default easymqtt;
