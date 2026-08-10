import { Config } from "application/constants";

const websocketUrl = () => {
  const baseUrl = Config.STAGE.BASE_URL.replace(/^http/, "ws");
  return `${baseUrl}/agent/ws`;
};

const agentUrl = () => `${Config.STAGE.BASE_URL}/agent`;

const connectOverHttp = ({ input, language, sessionId, command, onEvent, onError, onClose }) => {
  let controller = null;
  let closed = false;
  let pendingQuestion = null;

  const run = async (nextInput, nextCommand = null) => {
    controller = new AbortController();
    try {
      const response = await fetch(`${agentUrl()}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: nextInput,
          language,
          session_id: sessionId,
          command: nextCommand,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Agent HTTP ${response.status}`);
      const payload = await response.json();
      if (!Array.isArray(payload.events)) throw new Error("Resposta inválida do agent.");
      payload.events.forEach((event) => {
        if (event.type === "question") pendingQuestion = event.question;
        onEvent(event);
      });
    } catch (error) {
      if (error.name !== "AbortError") onError(error);
    } finally {
      if (!closed) onClose();
    }
  };

  const connection = {
    close: () => {
      closed = true;
      controller?.abort();
    },
    sendAnswer: (answer) => {
      if (closed || !String(answer || "").trim()) return false;
      const nextInput = pendingQuestion
        ? `Em resposta à pergunta "${pendingQuestion}": ${String(answer).trim()}`
        : String(answer).trim();
      pendingQuestion = null;
      run(nextInput);
      return true;
    },
  };
  run(input, command);
  return connection;
};

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
  if (Config.STAGE.AGENT_TRANSPORT === "http") {
    return connectOverHttp({ input, language, sessionId, command, onEvent, onError, onClose });
  }

  const socket = new WebSocket(websocketUrl());

  socket.onopen = () => socket.send(JSON.stringify({ type: "start", input, language, session_id: sessionId, command }));
  socket.onmessage = ({ data }) => onEvent(JSON.parse(data));
  socket.onerror = onError;
  socket.onclose = onClose;

  return socket;
};

export const sendAgentAnswer = (socket, questionId, answer) => {
  if (typeof socket?.sendAnswer === "function") return socket.sendAnswer(answer);
  if (socket?.readyState !== WebSocket.OPEN) return false;

  socket.send(JSON.stringify({ type: "answer", question_id: questionId, answer }));
  return true;
};
