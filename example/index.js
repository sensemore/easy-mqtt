const { easymqtt } = require("../dist/cjs");

//connect uses mqtt client options from mqtt package (see mqtt.connect)
easymqtt.connect({
    host: "localhost",
    port: 1883,
});

//you can use mqtt client directly
easymqtt.client.on("connect", () => {
    console.log("connected");

    //publish message
    easymqtt.publish("test", "hello world");

});

//define handler
easymqtt.on("test", (params, payload) => {
    console.log(`received message on topic test with payload ${payload}`);
});

//define handlers with parameters (using mqtt-pattern package)
easymqtt.on("test/+param1/test", (params, payload) => {
    const { param1 } = params;
    const msg = payload.toString();
    console.log(`received message on topic test/${param1}/test with payload ${msg}`);
});

//Advanced usage

//define dynamic handler with pattern
const handler = easymqtt.addHandler({
    pattern: "country/+country/city/+city",
    handle: (params, payload) => {
        const { country, city } = params;
        let msg = payload.toString();
        console.log(`received message on topic country/${country}/city/${city} with message ${msg}`, params);
    }
});
//and remove it later
easymqtt.removeHandler(handler);


async function test() {
    try {
        //define rpc handler
        const rpcRequest = {
            request: "device/+deviceId/battery/request",
            response: "device/+deviceId/battery/response",
            error: "device/+deviceId/battery/error", //optional
            message: "hello world",
            timeout: 5000
        };

        const response = await easymqtt.rpc(rpcRequest);
        console.log(`received response `, response);
    }
    catch (err) {
        console.log(`error`, err);
    }
}

test();






