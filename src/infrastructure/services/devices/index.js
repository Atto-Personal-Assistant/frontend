import { Config } from "application/constants";

import { AttoNode, browserMusicHandler, browserCameraHandler, browserCameraStreamOfferHandler, stopBrowserCamera } from "../../devices/attoNode";

export { AttoNode, browserMusicHandler, browserCameraHandler, stopBrowserCamera };

const LOCAL_NODE_IDENTITY = "atto.local-node.identity";

const newDeviceId = () => {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `browser-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const readLocalNodeIdentity = () => {
  try {
    const stored = JSON.parse(window.localStorage.getItem(LOCAL_NODE_IDENTITY) || "null");
    if (stored?.id) return stored;
  } catch (_) {
    // Invalid local state is replaced below.
  }
  return { id: newDeviceId(), token: null };
};

export const startLocalAttoNode = async ({ name = "Este dispositivo", allowRecovery = true } = {}) => {
  const identity = readLocalNodeIdentity();
  const showSharedContent = (media = false) => async (payload, command) => {
    window.dispatchEvent(new CustomEvent("atto:shared-content", {
      detail: { ...payload, sender: command.sender, media },
    }));
    return { displayed: true };
  };
  const handlers = {
    "music.play": browserMusicHandler,
    "share_content": showSharedContent(false),
    "view_content": showSharedContent(false),
    "view_media": showSharedContent(true),
    "camera.stop": async () => {
      stopBrowserCamera();
      return { camera_open: false };
    },
    "camera.stream.offer": browserCameraStreamOfferHandler,
  };
  if (navigator.mediaDevices?.getUserMedia) handlers["camera.capture"] = browserCameraHandler;
  const node = new AttoNode({
    name,
    kind: "desktop",
    // An ID without its token cannot authenticate an existing device. In
    // that case register a fresh identity instead of creating a tokenless node.
    deviceId: identity.token ? identity.id : newDeviceId(),
    deviceToken: identity.token || null,
    handlers,
    onRegistered: (device) => {
      window.localStorage.setItem(LOCAL_NODE_IDENTITY, JSON.stringify({ id: device.id, token: device.token }));
    },
  });
  try {
    await node.start();
    return node;
  } catch (error) {
    // A stale or partially persisted identity may be accepted by an older
    // API but still return no token. Discard it and perform one fresh pair.
    if (allowRecovery && (error.status === 401 || String(error.message || "").includes("não retornou o token"))) {
      window.localStorage.removeItem(LOCAL_NODE_IDENTITY);
      return startLocalAttoNode({ name, allowRecovery: false });
    }
    throw error;
  }
};

const headers = () => ({
  "Content-Type": "application/json",
  ...(process.env.REACT_APP_INTERNAL_TOKEN
    ? { "X-Atto-Internal-Token": process.env.REACT_APP_INTERNAL_TOKEN }
    : {}),
});

export const listDevices = async () => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices`, { headers: headers() });
  if (!response.ok) throw new Error("Não foi possível carregar os dispositivos.");
  return response.json();
};

export const registerDevice = async ({ name, kind = "desktop", capabilities = ["display", "notification"] }) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices/register`, {
    method: "POST", headers: headers(), body: JSON.stringify({ name, kind, capabilities }),
  });
  if (!response.ok) throw new Error("Não foi possível cadastrar o dispositivo.");
  return response.json();
};

export const renameDevice = async (deviceId, name) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices/${encodeURIComponent(deviceId)}`, {
    method: "PATCH", headers: headers(), body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error("Não foi possível alterar o dispositivo.");
  return response.json();
};

export const activateDevice = async (deviceId) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices/${encodeURIComponent(deviceId)}/activate`, { method: "POST", headers: headers() });
  if (!response.ok) throw new Error("Não foi possível ativar o dispositivo.");
  return response.json();
};

export const sendDeviceCommand = async (deviceId, action, payload) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices/${encodeURIComponent(deviceId)}/commands`, {
    method: "POST", headers: headers(), body: JSON.stringify({ action, payload, sender_device_id: localStorage.getItem("atto.active-device") }),
  });
  if (!response.ok) throw new Error("Não foi possível compartilhar o conteúdo.");
  return response.json();
};

const waitForDeviceCommand = async (commandId, { signal, timeoutMs = 15000 } = {}) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (signal?.aborted) throw new DOMException("Captura cancelada.", "AbortError");
    const response = await fetch(`${Config.STAGE.BASE_URL}/devices/commands/${encodeURIComponent(commandId)}`, {
      headers: headers(), signal,
    });
    if (!response.ok) throw new Error("Não foi possível receber o quadro da câmera.");
    const result = await response.json();
    if (result.status === "completed") {
      if (!result.success) throw new Error(result.error || "A captura da câmera falhou.");
      return result.result || {};
    }
    await new Promise((resolve) => window.setTimeout(resolve, 40));
  }
  throw new Error("A câmera demorou demais para responder.");
};

const configuredIceServers = () => {
  try {
    const configured = JSON.parse(process.env.REACT_APP_WEBRTC_ICE_SERVERS || "null");
    if (Array.isArray(configured) && configured.length) return configured;
  } catch (_) {
    // Use public STUN when no custom STUN/TURN list was supplied.
  }
  return [{ urls: "stun:stun.l.google.com:19302" }];
};

const gatherIce = (peer, timeoutMs = 5000) => new Promise((resolve) => {
  if (peer.iceGatheringState === "complete") return resolve();
  const timeout = window.setTimeout(done, timeoutMs);
  function done() { window.clearTimeout(timeout); peer.removeEventListener("icegatheringstatechange", changed); resolve(); }
  function changed() { if (peer.iceGatheringState === "complete") done(); }
  peer.addEventListener("icegatheringstatechange", changed);
});

export const openRemoteCameraStream = async (deviceId, { signal, onStream } = {}) => {
  const peer = new RTCPeerConnection({ iceServers: configuredIceServers() });
  const stream = new MediaStream();
  peer.addTransceiver("video", { direction: "recvonly" });
  peer.ontrack = ({ track, streams }) => {
    const incoming = streams?.[0];
    if (incoming) onStream?.(incoming);
    else { stream.addTrack(track); onStream?.(stream); }
  };
  const abort = () => peer.close();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    await peer.setLocalDescription(await peer.createOffer());
    await gatherIce(peer);
    if (signal?.aborted) throw new DOMException("Transmissão cancelada.", "AbortError");
    const command = await sendDeviceCommand(deviceId, "camera.stream.offer", {
      offer: peer.localDescription.toJSON(),
      consent_required: true,
    });
    if (!command.command_id) throw new Error("A transmissão não retornou um identificador.");
    const result = await waitForDeviceCommand(command.command_id, { signal });
    if (!result.answer) throw new Error("O dispositivo não retornou a resposta WebRTC.");
    await peer.setRemoteDescription(result.answer);
    return peer;
  } catch (error) {
    peer.close();
    throw error;
  } finally {
    signal?.removeEventListener("abort", abort);
  }
};

export const uploadDeviceMedia = async (deviceId, file, title = "") => {
  const form = new FormData();
  form.append("file", file);
  form.append("title", title || file.name);
  const sender = localStorage.getItem("atto.active-device");
  if (sender) form.append("sender_device_id", sender);
  const response = await fetch(`${Config.STAGE.BASE_URL}/devices/${encodeURIComponent(deviceId)}/media`, { method: "POST", body: form });
  if (!response.ok) throw new Error("Não foi possível compartilhar a mídia.");
  return response.json();
};

export const uploadChatMedia = async (file) => {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${Config.STAGE.BASE_URL}/media/upload`, { method: "POST", body: form });
  if (!response.ok) throw new Error("Não foi possível salvar a mídia no chat.");
  return response.json();
};
