import { Config } from "application/constants";

const nodeUrl = (baseUrl) => {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
};

/**
 * Runtime for a local Atto Node. The node only knows the command protocol;
 * platform-specific work is supplied through handlers.
 */
export class AttoNode {
  constructor({
    name,
    kind = "desktop",
    capabilities = ["display", "notification", "music.play"],
    baseUrl = Config.STAGE.BASE_URL,
    fetchImpl = window.fetch.bind(window),
    webSocketImpl = window.WebSocket,
    heartbeatMs = 30000,
    reconnectMs = 1500,
    handlers = {},
  } = {}) {
    if (!name) throw new Error("Atto Node precisa de um nome.");
    this.name = name;
    this.kind = kind;
    this.capabilities = capabilities;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetch = fetchImpl;
    this.WebSocket = webSocketImpl;
    this.heartbeatMs = heartbeatMs;
    this.reconnectMs = reconnectMs;
    this.handlers = handlers;
    this.device = null;
    this.socket = null;
    this.heartbeatTimer = null;
    this.reconnectTimer = null;
    this.stopped = true;
  }

  async start() {
    this.stopped = false;
    if (!this.device) await this.register();
    this.connect();
    return this.device;
  }

  stop() {
    this.stopped = true;
    window.clearTimeout(this.reconnectTimer);
    window.clearInterval(this.heartbeatTimer);
    this.socket?.close();
    this.socket = null;
  }

  async register() {
    const response = await this.fetch(`${this.baseUrl}/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: this.name, kind: this.kind, capabilities: this.capabilities }),
    });
    if (!response.ok) throw new Error("Não foi possível registrar o Atto Node.");
    const result = await response.json();
    this.device = { ...result.device, token: result.device_token || this.device?.token };
    if (!this.device.token) throw new Error("O servidor não retornou o token do Atto Node.");
    return this.device;
  }

  connect() {
    if (this.stopped || !this.device || this.socket) return;
    const url = nodeUrl(`${this.baseUrl}/devices/${encodeURIComponent(this.device.id)}/events`);
    url.searchParams.set("token", this.device.token);
    const socket = new this.WebSocket(url.toString());
    this.socket = socket;
    socket.onopen = () => {
      this.heartbeat();
      this.heartbeatTimer = window.setInterval(() => this.heartbeat(), this.heartbeatMs);
      this.handlers.connected?.(this.device);
    };
    socket.onmessage = ({ data }) => this.dispatch(JSON.parse(data));
    socket.onerror = (error) => this.handlers.error?.(error);
    socket.onclose = () => {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
      this.socket = null;
      this.handlers.disconnected?.();
      if (!this.stopped) this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectMs);
    };
  }

  async heartbeat() {
    if (!this.device) return;
    try {
      await this.fetch(`${this.baseUrl}/devices/${encodeURIComponent(this.device.id)}/heartbeat?token=${encodeURIComponent(this.device.token)}`, { method: "POST" });
    } catch (error) {
      this.handlers.error?.(error);
    }
  }

  async dispatch(command) {
    const handler = this.handlers[command.action];
    try {
      if (!handler) throw new Error(`Comando não suportado: ${command.action}`);
      const result = await handler(command.payload || {}, command);
      this.ack(command.id, true, result);
    } catch (error) {
      this.ack(command.id, false, undefined, error.message);
      this.handlers.commandError?.(error, command);
    }
  }

  ack(commandId, success, result, error) {
    if (!this.socket || this.socket.readyState !== this.WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ command_id: commandId, success, result, error }));
  }
}

export const browserMusicHandler = async ({ uri, url, title }) => {
  const source = url || uri;
  if (!source) throw new Error("O comando de música não possui uma fonte reproduzível.");
  const audio = new Audio(source);
  audio.title = title || "Atto";
  await audio.play();
  return { playing: true, source };
};
