import { Config } from "application/constants";

const websocketUrl = () => {
  const baseUrl = Config.STAGE.BASE_URL.replace(/^http/, "ws");
  return `${baseUrl}/agent/ws`;
};

const agentUrl = () => `${Config.STAGE.BASE_URL}/agent`;

export const deleteAgentSession = async (sessionId) => {
  const response = await fetch(`${agentUrl()}/sessions/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error("Não foi possível excluir a sessão no servidor.");
  return response.json();
};

export const listAgentSessionActions = async (sessionId) => {
  const response = await fetch(`${agentUrl()}/sessions/${encodeURIComponent(sessionId)}/actions`);
  if (!response.ok) throw new Error("Não foi possível carregar as ações da sessão.");
  const payload = await response.json();
  return Array.isArray(payload.actions) ? payload.actions : [];
};

export const getAgentSession = async (sessionId) => {
  const response = await fetch(`${agentUrl()}/sessions/${encodeURIComponent(sessionId)}`);
  if (!response.ok) throw new Error("Não foi possível carregar a conversa.");
  return response.json();
};

export const connectToAgent = ({ input, language, sessionId, command, onEvent, onError, onClose }) => {
  const socket = new WebSocket(websocketUrl());

  socket.onopen = () => socket.send(JSON.stringify({ type: "start", input, language, session_id: sessionId, command }));
  socket.onmessage = ({ data }) => onEvent(JSON.parse(data));
  socket.onerror = onError;
  socket.onclose = onClose;

  return socket;
};

export const sendAgentAnswer = (socket, questionId, answer) => {
  if (socket?.readyState !== WebSocket.OPEN) return false;

  socket.send(JSON.stringify({ type: "answer", question_id: questionId, answer }));
  return true;
};
