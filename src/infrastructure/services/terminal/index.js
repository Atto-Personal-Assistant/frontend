import { Config } from "application/constants";

const headers = () => ({
  "Content-Type": "application/json",
  ...(process.env.REACT_APP_INTERNAL_TOKEN
    ? { "X-Atto-Internal-Token": process.env.REACT_APP_INTERNAL_TOKEN }
    : {}),
});

const wsBaseUrl = () => {
  const base = Config.STAGE.BASE_URL;
  return base.replace(/^http/, "ws");
};

export const openTerminal = async (cols = 80, rows = 24) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/terminal/open`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ cols, rows }),
  });
  if (!response.ok) throw new Error("Nao foi possivel abrir o terminal.");
  return response.json();
};

export const closeTerminal = async (sessionId) => {
  const response = await fetch(
    `${Config.STAGE.BASE_URL}/terminal/${encodeURIComponent(sessionId)}/close`,
    { method: "POST", headers: headers() }
  );
  if (!response.ok) throw new Error("Nao foi possivel fechar o terminal.");
  return response.json();
};

export const resizeTerminal = async (sessionId, cols, rows) => {
  const response = await fetch(
    `${Config.STAGE.BASE_URL}/terminal/${encodeURIComponent(sessionId)}/resize`,
    { method: "POST", headers: headers(), body: JSON.stringify({ cols, rows }) }
  );
  if (!response.ok) throw new Error("Nao foi possivel redimensionar o terminal.");
  return response.json();
};

export const terminalStatus = async (sessionId) => {
  const response = await fetch(
    `${Config.STAGE.BASE_URL}/terminal/${encodeURIComponent(sessionId)}/status`,
    { headers: headers() }
  );
  if (!response.ok) throw new Error("Nao foi possivel verificar o terminal.");
  return response.json();
};

export const getClipboard = async () => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/terminal/clipboard`, {
    headers: headers(),
  });
  if (!response.ok) throw new Error("Nao foi possivel ler o clipboard.");
  return response.json();
};

export const setClipboard = async (text) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/terminal/clipboard`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error("Nao foi possivel salvar no clipboard.");
  return response.json();
};

export const connectTerminalWs = (sessionId) => {
  return new WebSocket(
    `${wsBaseUrl()}/terminal/${encodeURIComponent(sessionId)}/ws`
  );
};
