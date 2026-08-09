import { useEffect, useRef, useState } from "react";

import { connectToAgent, sendAgentAnswer } from "infrastructure/services";

const portuguesePattern = /[ãõáéíóúâêôç]|\b(como|não|nao|para|por|projeto|revise|resumo|ajuda|quero|preciso|pode|você|voce)\b/i;

const language = (message = "") => {
  if (portuguesePattern.test(message)) return "pt-BR";
  return navigator.language || "pt-BR";
};

const statusMessage = (event, locale) => {
  if (locale.toLowerCase().startsWith("pt")) return event.message;

  const messages = {
    started: "Preparing the agent.",
    planning: "Understanding the request and selecting a capability.",
    planned: "Plan defined.",
    working: "Running the selected capability.",
    thinking: "Analyzing the next step.",
    answer_received: "Answer received; continuing execution.",
  };

  if (event.type === "action") return `Running ${event.tool}.`;
  if (event.type === "tool_result") return event.success ? `${event.tool} completed.` : `${event.tool} failed.`;
  return messages[event.stage] || event.message;
};

const speak = (message, locale) => {
  if (!("speechSynthesis" in window) || !message) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = locale;
  window.speechSynthesis.speak(utterance);
};

const activityFor = (event) => {
  if (event.type === "action") return { icon: "↗", title: `Executando ${event.tool}`, detail: "Ação em andamento", state: "active" };
  if (event.type === "tool_result") return {
    icon: event.success ? "✓" : "!",
    title: event.success ? `${event.tool} concluída` : `${event.tool} falhou`,
    detail: event.message,
    state: event.success ? "done" : "error",
  };
  if (event.type === "question") return { icon: "?", title: "Sua decisão é necessária", detail: event.question, state: "active" };
  if (event.type === "result") return { icon: "✓", title: "Resposta pronta", detail: "Execução concluída", state: "done" };
  if (event.type === "error") return { icon: "!", title: "Execução interrompida", detail: event.message, state: "error" };

  const stages = {
    started: ["◌", "Solicitação recebida", "Preparando o ambiente"],
    planning: ["◌", "Entendendo a solicitação", "Escolhendo a melhor abordagem"],
    planned: ["✓", "Plano definido", "Pronto para executar"],
    working: ["↗", "Executando o plano", "O agente começou o trabalho"],
    thinking: ["◌", "Analisando o próximo passo", "Raciocinando sobre o projeto"],
    answer_received: ["✓", "Decisão recebida", "Continuando a execução"],
  };
  const [icon, title, detail] = stages[event.stage] || ["◌", "Atualização do agente", event.message];
  return { icon, title, detail, state: event.stage === "planned" ? "done" : "active" };
};

export const useUse = () => {
  const socket = useRef(null);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activities, setActivities] = useState([]);
  const recognition = useRef(null);
  const [messages, setMessages] = useState([
    { actor: "Atto", message: "Como eu posso te ajudar?" },
  ]);

  useEffect(() => () => {
    socket.current?.close();
    recognition.current?.abort?.();
  }, []);

  const addActivity = (event) => {
    setActivities((previous) => [
      ...previous,
      { id: `${Date.now()}-${Math.random()}`, at: new Date(), ...activityFor(event) },
    ]);
  };

  const addAssistantMessage = (message, shouldSpeak = true) => {
    setMessages((previous) => [...previous, { actor: "Atto", message }]);
    if (shouldSpeak && voiceEnabled) speak(message, language(message));
  };

  const handleAgentEvent = (event) => {
    if (event.type === "status" || event.type === "action" || event.type === "tool_result") {
      setStatus(statusMessage(event, language()));
      addActivity(event);
      return;
    }

    if (event.type === "question") {
      setStatus("");
      setPendingQuestion(event);
      addAssistantMessage(event.question);
      addActivity(event);
      return;
    }

    if (event.type === "result") {
      setStatus("");
      addAssistantMessage(event.message);
      addActivity(event);
      return;
    }

    if (event.type === "error") {
      setStatus("");
      addAssistantMessage(event.message);
      setIsRunning(false);
      addActivity(event);
      return;
    }

    if (event.type === "finished") {
      setIsRunning(false);
      setStatus("");
    }
  };

  const handleInput = ({ target: { value } }) => setInput(value);

  const sendRequest = () => {
    const message = input.trim();
    if (!message || isRunning) return;

    setMessages((previous) => [...previous, { actor: "user", message }]);
    setActivities([{ id: `${Date.now()}-request`, at: new Date(), icon: "●", title: "Nova solicitação", detail: message, state: "active" }]);
    setInput("");
    setStatus(language().toLowerCase().startsWith("pt") ? "Conectando ao agent..." : "Connecting to the agent...");
    setIsRunning(true);
    socket.current = connectToAgent({
      input: message,
      language: language(message),
      onEvent: handleAgentEvent,
      onError: () => addAssistantMessage("Não foi possível conectar ao agent."),
      onClose: () => setIsRunning(false),
    });
  };

  const startListening = () => {
    if (isListening) {
      recognition.current?.stop?.();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("O ditado por voz não é compatível com este navegador.");
      return;
    }

    const instance = new SpeechRecognition();
    instance.lang = language(input);
    instance.interimResults = false;
    instance.maxAlternatives = 1;
    instance.onstart = () => {
      setIsListening(true);
      setStatus("Ouvindo... fale sua mensagem.");
    };
    instance.onresult = (event) => {
      setInput(event.results[0][0].transcript);
      setStatus("Mensagem transcrita. Revise ou envie.");
    };
    instance.onerror = () => setStatus("Não foi possível captar o áudio. Verifique a permissão do microfone.");
    instance.onend = () => setIsListening(false);
    recognition.current = instance;
    instance.start();
  };

  const answerQuestion = (answer) => {
    const message = answer.trim();
    if (!message || !pendingQuestion) return;

    setMessages((previous) => [...previous, { actor: "user", message }]);
    if (sendAgentAnswer(socket.current, pendingQuestion.question_id, message)) {
      setPendingQuestion(null);
      setInput("");
      setStatus(language().toLowerCase().startsWith("pt") ? "Enviando sua decisão ao agent..." : "Sending your decision to the agent...");
    }
  };

  return {
    input,
    messages,
    status,
    isRunning,
    pendingQuestion,
    handleInput,
    sendRequest,
    answerQuestion,
    isListening,
    startListening,
    activities,
    voiceEnabled,
    setVoiceEnabled,
  };
};
