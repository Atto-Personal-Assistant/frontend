import { Config } from "application/constants";

import { AttoNode, browserMusicHandler, browserCameraHandler, stopBrowserCamera } from "../../devices/attoNode";

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
