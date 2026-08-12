import { Config } from "application/constants";

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
