import { AttoNode } from "./attoNode";

describe("AttoNode", () => {
  const response = (body, ok = true) => ({ ok, json: async () => body });

  test("registers, connects, dispatches commands, and acknowledges them", async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(response({ device: { id: "node-1" }, device_token: "secret" }))
      .mockResolvedValue(response({ online: true }));
    const sockets = [];
    class FakeSocket {
      static OPEN = 1;
      constructor(url) { this.url = url; this.readyState = 0; sockets.push(this); }
      send(message) { this.sent = JSON.parse(message); }
      close() { this.onclose?.(); }
    }
    const play = jest.fn().mockResolvedValue({ playing: true });
    const node = new AttoNode({
      name: "Notebook",
      baseUrl: "https://atto.test",
      fetchImpl,
      webSocketImpl: FakeSocket,
      handlers: { "music.play": play },
    });

    await node.start();
    const socket = sockets[0];
    socket.readyState = FakeSocket.OPEN;
    socket.onopen();
    await socket.onmessage({ data: JSON.stringify({ id: "command-1", action: "music.play", payload: { uri: "song" } }) });

    expect(socket.url).toContain("wss://atto.test/devices/node-1/events");
    expect(socket.url).toContain("token=secret");
    expect(play).toHaveBeenCalledWith({ uri: "song" }, expect.objectContaining({ id: "command-1" }));
    expect(socket.sent).toMatchObject({ command_id: "command-1", success: true, result: { playing: true } });
    node.stop();
  });

  test("acknowledges unsupported commands as failures", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ device: { id: "node-1" }, device_token: "secret" }));
    const socket = { readyState: 1, send: jest.fn(), close: jest.fn() };
    const node = new AttoNode({ name: "Notebook", fetchImpl, webSocketImpl: class { static OPEN = 1; } });
    node.device = { id: "node-1", token: "secret" };
    node.socket = socket;

    await node.dispatch({ id: "command-2", action: "unknown", payload: {} });

    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('"success":false'));
  });

  test("advertises camera capture only when a camera handler is installed", () => {
    const node = new AttoNode({
      name: "Notebook",
      handlers: { "camera.capture": jest.fn() },
    });

    expect(node.capabilities).toContain("camera.capture");
  });

  test("registers with its own persisted identity", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ device: { id: "device-a" }, device_token: "token-a" }));
    const node = new AttoNode({
      name: "Notebook",
      deviceId: "device-a",
      deviceToken: "token-a",
      fetchImpl,
    });

    await node.register();

    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({ device_id: "device-a", device_token: "token-a" });
  });

  test("keeps its persisted token when refreshing an existing device", async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response({ device: { id: "device-a" } }));
    const node = new AttoNode({ name: "Notebook", deviceId: "device-a", deviceToken: "token-a", fetchImpl });

    await node.register();

    expect(node.device.token).toBe("token-a");
  });
});
