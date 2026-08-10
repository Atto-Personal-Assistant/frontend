import { useEffect, useRef, useState } from "react";

import { connectToAgent, deleteAgentSession, getAgentSession, listAgentSessionActions, sendAgentAnswer } from "infrastructure/services";

const language = () => "pt-BR";
const chatStorageKey = "atto.agent.chats.v1";

const createChat = () => ({
  id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  sessionId: window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random()}`,
  title: "Nova conversa",
  createdAt: new Date().toISOString(),
  messages: [{ actor: "Atto", message: "Como eu posso te ajudar?" }],
  activities: [],
});

const loadChats = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(chatStorageKey));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {
    // A malformed local cache must not prevent the chat from opening.
  }
  return [createChat()];
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

const speak = (message, locale, handlers = {}) => {
  const { onStart, onEnd, onError, retainUtterance } = handlers;
  if (!("speechSynthesis" in window)) {
    onError?.("Este navegador não oferece síntese de voz.");
    return;
  }
  if (!message) return;

  let started = false;
  const start = () => {
    if (started) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) {
      onError?.("Nenhuma voz do sistema foi encontrada. Instale ou ative uma voz nas configurações do sistema.");
      return;
    }
    started = true;
    const voice = voices.find(({ lang }) => lang.toLowerCase() === locale.toLowerCase())
      || voices.find(({ lang }) => lang.toLowerCase().startsWith("pt"));
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = locale;
    utterance.rate = 1;
    if (voice) utterance.voice = voice;
    retainUtterance?.(utterance);
    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = (event) => onError?.(`A reprodução foi interrompida (${event.error || "erro desconhecido"}).`);
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
  };

  if (window.speechSynthesis.getVoices().length) {
    start();
    return;
  }

  window.speechSynthesis.onvoiceschanged = start;
  window.setTimeout(start, 800);
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
  const roadmapDetail = event.stage === "planned" && event.skill
    ? `Skill selecionada: ${event.skill}`
    : detail;
  return { icon, title, detail: roadmapDetail, state: event.stage === "planned" ? "done" : "active" };
};

export const useUse = () => {
  const socket = useRef(null);
  const initialChats = useRef(null);
  if (!initialChats.current) initialChats.current = loadChats();
  const activeUtterance = useRef(null);
  const speechRequestId = useRef(0);
  const [chats, setChats] = useState(initialChats.current);
  const [activeChatId, setActiveChatId] = useState(initialChats.current[0].id);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const recognition = useRef(null);

  const activeChat = chats.find(({ id }) => id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const activities = activeChat?.activities || [];

  useEffect(() => () => {
    socket.current?.close();
    recognition.current?.abort?.();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(chatStorageKey, JSON.stringify(chats));
  }, [chats]);

  useEffect(() => {
    let active = true;
    if (!activeChat?.sessionId) return undefined;
    getAgentSession(activeChat.sessionId)
      .then(({ messages: canonicalMessages }) => {
        if (!active || !Array.isArray(canonicalMessages) || !canonicalMessages.length) return;
        setChats((current) => current.map((chat) => chat.id === activeChat.id ? {
          ...chat,
          messages: canonicalMessages.map(({ role, content, action }) => ({
            actor: role === "assistant" ? "Atto" : "user",
            message: content,
            action: action || null,
          })),
        } : chat));
      })
      .catch(() => {});
    listAgentSessionActions(activeChat.sessionId)
      .then((actions) => { if (active) setAvailableActions(actions); })
      .catch(() => { if (active) setAvailableActions([]); });
    return () => { active = false; };
  }, [activeChat?.id, activeChat?.sessionId]);

  const updateActiveChat = (updater) => {
    setChats((previous) => previous.map((chat) => (
      chat.id === activeChatId ? updater(chat) : chat
    )));
  };

  const addActivity = (event) => {
    updateActiveChat((chat) => ({
      ...chat,
      activities: [...chat.activities, { id: `${Date.now()}-${Math.random()}`, at: new Date(), ...activityFor(event) }],
    }));
  };

  const addAssistantMessage = (message, shouldSpeak = true, action = null) => {
    updateActiveChat((chat) => ({
      ...chat,
      messages: [...chat.messages, { actor: "Atto", message, action }],
    }));
    if (shouldSpeak && voiceEnabled) playSpeech(message);
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
      addAssistantMessage(event.message, true, event.action);
      if (event.action) {
        setAvailableActions((current) => current.some(({ name }) => name === event.action.name)
          ? current
          : [...current, event.action]);
      }
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

  const copyMessage = async (messageId, message) => {
    try {
      await navigator.clipboard.writeText(message);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = message;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopiedMessageId(messageId);
    window.setTimeout(() => setCopiedMessageId(null), 1800);
  };

  const playSpeech = (message, showStatus = false) => {
    const requestId = speechRequestId.current + 1;
    speechRequestId.current = requestId;
    speak(message, language(), {
      retainUtterance: (utterance) => { activeUtterance.current = utterance; },
      onStart: () => {
        if (showStatus && requestId === speechRequestId.current) setStatus("Lendo a resposta em voz alta...");
      },
      onEnd: () => {
        if (requestId !== speechRequestId.current) return;
        activeUtterance.current = null;
        if (showStatus) setStatus("");
      },
      onError: (messageError) => {
        if (requestId !== speechRequestId.current || messageError.includes("canceled")) return;
        setStatus(messageError);
      },
    });
  };

  const speakMessage = (message) => {
    setVoiceEnabled(true);
    playSpeech(message, true);
  };

  const sendRequest = () => {
    const message = input.trim();
    if (!message || isRunning) return;

    updateActiveChat((chat) => ({
      ...chat,
      title: chat.title === "Nova conversa" ? message.slice(0, 36) : chat.title,
      messages: [...chat.messages, { actor: "user", message }],
      activities: [...chat.activities, { id: `${Date.now()}-request`, at: new Date(), icon: "●", title: "Nova solicitação", detail: message, state: "active" }],
    }));
    setInput("");
    setStatus(language().toLowerCase().startsWith("pt") ? "Conectando ao agent..." : "Connecting to the agent...");
    setIsRunning(true);
    socket.current = connectToAgent({
      input: message,
      language: language(),
      sessionId: activeChat.sessionId,
      onEvent: handleAgentEvent,
      onError: () => addAssistantMessage("Não foi possível conectar ao agent."),
      onClose: () => setIsRunning(false),
    });
  };

  const rerunAction = (action) => {
    if (isRunning || !action?.name) return;
    const message = `Reexecutar: ${action.name}`;
    updateActiveChat((chat) => ({
      ...chat,
      messages: [...chat.messages, { actor: "user", message }],
      activities: [...chat.activities, { id: `${Date.now()}-rerun`, at: new Date(), icon: "↻", title: "Reexecutando ação", detail: action.name, state: "active" }],
    }));
    setStatus("Conectando ao agent...");
    setIsRunning(true);
    socket.current = connectToAgent({
      input: message,
      language: language(),
      sessionId: activeChat.sessionId,
      command: { operation: "repeat", action_name: action.name },
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

    updateActiveChat((chat) => ({
      ...chat,
      messages: [...chat.messages, { actor: "user", message }],
    }));
    if (sendAgentAnswer(socket.current, pendingQuestion.question_id, message)) {
      setPendingQuestion(null);
      setInput("");
      setStatus(language().toLowerCase().startsWith("pt") ? "Enviando sua decisão ao agent..." : "Sending your decision to the agent...");
    }
  };

  const deleteChat = async (chatId) => {
    if (isRunning) return;
    const chat = chats.find(({ id }) => id === chatId);
    if (!chat || !window.confirm(`Excluir a conversa “${chat.title}”? Esta ação não pode ser desfeita.`)) return;

    try {
      await deleteAgentSession(chat.sessionId);
    } catch (error) {
      setStatus(error.message || "Não foi possível excluir a conversa.");
      return;
    }

    const remaining = chats.filter(({ id }) => id !== chatId);
    const nextChats = remaining.length ? remaining : [createChat()];
    setChats(nextChats);
    if (chatId === activeChatId) setActiveChatId(nextChats[0].id);
    setInput("");
    setStatus("");
    setPendingQuestion(null);
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
    copiedMessageId,
    copyMessage,
    speakMessage,
    rerunAction,
    availableActions,
    chats,
    activeChatId,
    createNewChat: () => {
      if (isRunning) return;
      const chat = createChat();
      setChats((previous) => [chat, ...previous]);
      setActiveChatId(chat.id);
      setInput("");
      setStatus("");
      setPendingQuestion(null);
    },
    selectChat: (chatId) => {
      if (isRunning) return;
      setActiveChatId(chatId);
      setInput("");
      setStatus("");
      setPendingQuestion(null);
    },
    deleteChat,
  };
};
