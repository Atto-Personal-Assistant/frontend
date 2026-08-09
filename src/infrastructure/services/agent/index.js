import { Config } from "application/constants";

const websocketUrl = () => {
  const baseUrl = Config.STAGE.BASE_URL.replace(/^http/, "ws");
  return `${baseUrl}/agent/ws`;
};

export const connectToAgent = ({ input, language, onEvent, onError, onClose }) => {
  const socket = new WebSocket(websocketUrl());

  socket.onopen = () => socket.send(JSON.stringify({ type: "start", input, language }));
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
