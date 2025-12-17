import { Http2Engine, HttpEngine } from "../../src/engines";
import { Server } from "../../src/server";
describe("Server Integration Tests", () => {
describe("Http Engine", () => {
    it("should start the server and register routes correctly", async () => {
        const engine = new HttpEngine();
        const server = new Server(engine);

        server.route({ method: "GET", path: "", handler: async () => ({ status: 200, body: "Root" }) });

        await server.start(3000);

        expect(server['_routes'].length).toBe(1);
        expect(server['_routes'][0].path).toBe("/");
        await server.stop();
    });
});

describe("Http 2 Engine", () => {
    it("should start the server and register routes correctly", async () => {
        const engine = new Http2Engine();
        const server = new Server(engine);

        server.route({ method: "GET", path: "", handler: async () => ({ status: 200, body: "Root" }) });

        await server.start(3000);

        expect(server['_routes'].length).toBe(1);
        expect(server['_routes'][0].path).toBe("/");
        await server.stop();
    });

    it.skip("should start a secure server and register routes correctly", async () => {
        const engine = new Http2Engine({
            key: "",
            cert: ""

        });
        const server = new Server(engine);

        server.route({ method: "GET", path: "", handler: async () => ({ status: 200, body: "Root" }) });

        await server.start(3000);

        // expect(engine.isListening).toBe(true);
        expect(server['_routes'].length).toBe(1);
        expect(server['_routes'][0].path).toBe("/");
        await server.stop();
    });
});
});