import * as MQTTPattern from "mqtt-pattern"
import mqtt, { IClientOptions, MqttClient } from "mqtt"


class connectionParameters {
    protocol: 'wss' | 'ws' | 'mqtt' | 'mqtts' | 'tcp' | 'ssl' | 'wx' | 'wxs';
    username: string;
    password: string;
    host: string;
    port: number;

    constructor(protocol: string, username: string, password: string, host: string, port: number) {
        this.protocol = protocol as 'wss' | 'ws' | 'mqtt' | 'mqtts' | 'tcp' | 'ssl' | 'wx' | 'wxs';
        this.username = username;
        this.password = password;
        this.host = host;
        this.port = port;
    }
}

export interface Handler {
    pattern: string,
    handle(params: any, payload: any): void
}

export interface RPCRequest {
    request: string
    response: string
    error?: string
    timeout?: number
    message: string | Buffer
}

export interface Response {
    params: object
    payload: Buffer
}

const easymqtt = new class {
    handlers: Handler[] = [];
    _client: MqttClient | undefined;
    get client(): MqttClient {
        return this._client!;
    }
    initialized: boolean = false;

    onMessage(topic: string, payload: any) {
        this.handlers.forEach(handler => {
            if (MQTTPattern.matches(handler.pattern, topic)) {
                let params = MQTTPattern.exec(handler.pattern, topic);
                handler.handle(params, payload);
            }
        })
    }
    parseConnectionUrl(urlString: string): connectionParameters {
        try {
            const urlRegex = /^(\w+):\/\/(?:([^:@]+)(?::([^:@]+))?@)?([^:@]+):(\d+)$/;
            const match = urlRegex.exec(urlString);

            if (!match) {
                throw new Error(`Invalid connection URL: ${urlString}\nExpected format: protocol://username:password@host:port`);
            }

            const protocol = match[1];
            const username = match[2];
            const password = match[3];
            const host = match[4];
            const port = parseInt(match[5]);

            const connection: connectionParameters = new connectionParameters(protocol, username, password, host, port);
            return connection;
        }
        catch (err: any) {
            console.error(err);
            throw new Error(err);
        }
    }
    connect(options: IClientOptions) {
        if (this.initialized) {
            return;
        }

        if (options.url) {
            const connection = this.parseConnectionUrl(options.url);
            options.protocol = connection.protocol;
            options.username = connection.username;
            options.password = connection.password;
            options.host = connection.host;
            options.port = connection.port;
        }

        this._client = mqtt.connect(options);

        this.client.on('connect', () => {
            console.debug('connected to mqtt broker');
        });
        this.client.on("message", (topic, payload) => this.onMessage(topic, payload));
        this.client.on('error', (err) => {
            console.error(err);
            this.client!.end();
        });
        this.initialized = true;
    }
    publish(topic: string, message: string | Buffer) {
        //check message type
        if (typeof message === "string") {
            message = Buffer.from(message);
        }
        this.client!.publish(topic, message);
    }
    rpc(rpcRequest: RPCRequest): Promise<Response> {

        let timeout = rpcRequest.timeout || 5000;
        return new Promise((resolve, reject) => {

            const responseHandler: Handler = {
                pattern: rpcRequest.response,
                handle: (params, msg) => {
                    clear();
                    resolve({ params: params, payload: msg });
                }

            };

            const rejectHandler: Handler | null = rpcRequest.error ? {
                pattern: rpcRequest.error,
                handle: (params, msg) => {
                    clear();
                    reject({ params, msg });
                }
            } : null;
            const unsubscribe = () => {
                this.removeHandler(responseHandler);
                if (rejectHandler) {
                    this.removeHandler(rejectHandler);
                }
            };

            const timeoutHandler = setTimeout(() => {
                unsubscribe();
                reject({ params: {}, msg: "timeout" });
            }, timeout);

            const clear = () => {
                unsubscribe();
                clearTimeout(timeoutHandler);
            };


            this.addHandler(responseHandler);
            if (rejectHandler) {
                this.addHandler(rejectHandler);
            }

            this.publish(MQTTPattern.clean(rpcRequest.request), rpcRequest.message);

        });
    }

    on(pattern: string, method: (params: any, payload: any) => void) {
        this.addHandler({
            pattern: pattern,
            handle: (params, payload) => method(params, payload)
        })
    }

    addHandler(handler: Handler): Handler {
        let topic = MQTTPattern.clean(handler.pattern);
        //check if handler already exists
        if (this.handlers.find(e => e.pattern === handler.pattern)) {
            throw new Error("handler already exists");
        }
        this.client!.subscribe(topic, (err) => {
            if (err) {
                console.error(err);
            }
            console.debug(`subscribed to ${topic}`);
            this.handlers.push(handler);

        });
        return handler;
    }
    removeHandler(handler: Handler) {
        let topic = MQTTPattern.clean(handler.pattern);
        //check if handler exists
        if (!this.handlers.find(e => e.pattern === handler.pattern)) {
            return;
        }
        this.client!.unsubscribe(topic, (err: any) => {
            if (err) {
                console.error(err);
            }
            console.debug(`unsubscribed from ${topic}`);
            this.handlers = this.handlers.filter(e => e.pattern !== handler.pattern);
        });
    }
};
export { easymqtt };
export default easymqtt;
