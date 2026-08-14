import { Config } from "application/constants";

const nodeUrl = (baseUrl) => {
  const url = new URL(baseUrl);
  // Keep the transport secure when the API is served over HTTPS. Browsers
  // block ws:// from an HTTPS page as mixed content.
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
    deviceId = null,
    deviceToken = null,
    onRegistered = null,
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
    this.deviceId = deviceId;
    this.deviceToken = deviceToken;
    this.onRegistered = onRegistered;
    if (typeof this.handlers["camera.capture"] === "function" && !this.capabilities.includes("camera.capture")) {
      this.capabilities = [...this.capabilities, "camera.capture"];
    }
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
    const registration = { name: this.name, kind: this.kind, capabilities: this.capabilities };
    if (this.deviceId) registration.device_id = this.deviceId;
    if (this.deviceToken) registration.device_token = this.deviceToken;
    const response = await this.fetch(`${this.baseUrl}/devices/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registration),
    });
    if (!response.ok) {
      const error = new Error("Não foi possível registrar o Atto Node.");
      error.status = response.status;
      throw error;
    }
    const result = await response.json();
    this.device = {
      ...result.device,
      // Refreshing a registered device intentionally does not issue a new
      // token. Keep the token used for authentication when the API omits it.
      token: result.device_token || this.deviceToken || this.device?.token,
    };
    if (!this.device.token) {
      throw new Error(`O servidor não retornou o token do Atto Node (device_id=${this.device.id || "unknown"}).`);
    }
    this.deviceId = this.device.id;
    this.deviceToken = this.device.token;
    this.onRegistered?.(this.device);
    return this.device;
  }

  connect() {
    if (this.stopped || !this.device || this.socket) return;
    const url = nodeUrl(`${this.baseUrl}/devices/${encodeURIComponent(this.device.id)}/events`);
    url.searchParams.set("token", this.device.token);
    console.info("Atto Node: conectando WebSocket", url.toString().replace(/token=[^&]+/, "token=***"));
    const socket = new this.WebSocket(url.toString());
    this.socket = socket;
    socket.onopen = () => {
      console.info("Atto Node: WebSocket conectado", this.device.id);
      this.heartbeat();
      this.heartbeatTimer = window.setInterval(() => this.heartbeat(), this.heartbeatMs);
      this.handlers.connected?.(this.device);
    };
    socket.onmessage = ({ data }) => this.dispatch(JSON.parse(data));
    socket.onerror = (error) => {
      console.error("Atto Node: erro no WebSocket", error);
      this.handlers.error?.(error);
    };
    socket.onclose = () => {
      console.warn("Atto Node: WebSocket fechado", this.device.id);
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
      this.ack(command.id, false, undefined, error.message, error.code);
      this.handlers.commandError?.(error, command);
    }
  }

  ack(commandId, success, result, error, errorCode) {
    if (!this.socket || this.socket.readyState !== this.WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ command_id: commandId, success, result, error, error_code: errorCode }));
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

let activeCameraStream = null;
let activeCameraVideo = null;
let activeCameraPeer = null;

const waitForIceGathering = (peer, timeoutMs = 5000) => new Promise((resolve) => {
  if (peer.iceGatheringState === "complete") return resolve();
  const timeout = window.setTimeout(done, timeoutMs);
  function done() {
    window.clearTimeout(timeout);
    peer.removeEventListener("icegatheringstatechange", changed);
    resolve();
  }
  function changed() {
    if (peer.iceGatheringState === "complete") done();
  }
  peer.addEventListener("icegatheringstatechange", changed);
});

const publishCameraState = (stream) => {
  window.dispatchEvent(new CustomEvent("atto:camera-state", { detail: { stream } }));
};

export const stopBrowserCamera = () => {
  activeCameraPeer?.close();
  activeCameraPeer = null;
  activeCameraStream?.getTracks().forEach((track) => track.stop());
  if (activeCameraVideo) activeCameraVideo.srcObject = null;
  activeCameraStream = null;
  activeCameraVideo = null;
  publishCameraState(null);
};

export const browserCameraStreamOfferHandler = async ({ offer, ice_servers: iceServers, consent_required: consentRequired } = {}) => {
  if (consentRequired !== true || !offer?.sdp || offer.type !== "offer") {
    throw new Error("A transmissão da câmera exige uma oferta WebRTC autorizada.");
  }
  const camera = await openBrowserCamera({ showPreview: false });
  activeCameraPeer?.close();
  const peer = new RTCPeerConnection({ iceServers: Array.isArray(iceServers) ? iceServers : [] });
  activeCameraPeer = peer;
  camera.stream.getTracks().forEach((track) => peer.addTrack(track, camera.stream));
  peer.onconnectionstatechange = () => {
    if (["failed", "closed"].includes(peer.connectionState) && activeCameraPeer === peer) {
      stopBrowserCamera();
    }
  };
  await peer.setRemoteDescription(offer);
  await peer.setLocalDescription(await peer.createAnswer());
  await waitForIceGathering(peer);
  return { answer: peer.localDescription.toJSON(), camera_open: true, transport: "webrtc" };
};

const openBrowserCamera = async ({ showPreview = true } = {}) => {
  if (activeCameraStream?.active && activeCameraVideo) return { stream: activeCameraStream, video: activeCameraVideo };
  stopBrowserCamera();
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.autoplay = true;
  video.playsInline = true;
  try {
    await new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        const error = new Error("A câmera não ficou pronta a tempo.");
        error.code = "camera_timeout";
        reject(error);
      }, 5000);
      const ready = () => { window.clearTimeout(timeout); resolve(); };
      video.onloadeddata = ready;
      video.onerror = () => { window.clearTimeout(timeout); reject(new Error("Não foi possível ler o vídeo da câmera.")); };
      if (video.readyState >= 2) ready();
      else video.play().catch((error) => { window.clearTimeout(timeout); reject(error); });
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    throw error;
  }
  activeCameraStream = stream;
  activeCameraVideo = video;
  stream.getVideoTracks().forEach((track) => {
    track.onended = () => {
      if (activeCameraStream === stream) stopBrowserCamera();
    };
  });
  if (showPreview) publishCameraState(stream);
  return { stream, video };
};

export const browserCameraHandler = async ({ camera_id: cameraId = "default" } = {}) => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    const error = new Error("A câmera exige HTTPS ou localhost.");
    error.code = "camera_insecure_context";
    throw error;
  }
  let camera;
  try {
    // A command-triggered capture is viewed by the requesting client. Keep
    // the source stream alive without opening a second window on this device.
    camera = await openBrowserCamera({ showPreview: false });
  } catch (error) {
    const permissionError = new Error(
      error.name === "NotAllowedError"
        ? "A permissão da câmera foi negada no navegador ou no sistema operacional."
        : error.name === "NotFoundError"
          ? "Nenhuma câmera foi encontrada neste dispositivo."
          : `Não foi possível acessar a câmera: ${error.message || error.name}`,
    );
    permissionError.code = error.name === "NotAllowedError" ? "camera_permission_denied" : "camera_unavailable";
    throw permissionError;
  }
  const track = camera.stream.getVideoTracks()[0];
  if (!track) {
    stopBrowserCamera();
    const error = new Error("Nenhuma câmera disponível neste dispositivo.");
    error.code = "camera_unavailable";
    throw error;
  }
  const settings = track.getSettings();
  const canvas = document.createElement("canvas");
  const sourceWidth = settings.width || camera.video.videoWidth;
  const sourceHeight = settings.height || camera.video.videoHeight;
  // Snapshot transport goes through JSON/Base64. Cap the frame dimensions so
  // capture, encoding, network transfer and browser decoding remain responsive.
  const scale = Math.min(1, 960 / sourceWidth, 540 / sourceHeight);
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  canvas.getContext("2d").drawImage(camera.video, 0, 0, canvas.width, canvas.height);
  // Repeated remote frames favor latency and bandwidth over archival quality.
  const dataUrl = canvas.toDataURL("image/jpeg", 0.58);
  return { camera_id: cameraId, media_type: "image/jpeg", data_url: dataUrl, camera_open: true };
};
