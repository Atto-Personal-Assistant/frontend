import { useEffect, useRef, useState } from "react";

import { connectToAgent, deleteAgentSession, getAgentSession, listAgentSessionActions, sendAgentAnswer } from "infrastructure/services";
import { uploadChatMedia } from "infrastructure/services/devices";

const language = () => "pt-BR";
const chatStorageKey = "atto.agent.chats.v1";
const handsFreeStorageKey = "atto.voice.hands-free";

export const voiceCommandFromTranscript = (transcript, mode) => {
  const normalized = String(transcript || "").trim();
  if (mode !== "hands-free") return normalized;
  return normalized.match(/^\s*(?:atto|ato)[,.:;!\s]+(.+)$/i)?.[1]?.trim() || "";
};

const createChat = () => ({
  id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  sessionId: window.crypto?.randomUUID?.() || `session-${Date.now()}-${Math.random()}`,
  title: "Nova conversa",
  createdAt: new Date().toISOString(),
  messages: [],
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
    return () => {};
  }
  if (!message) return () => {};

  let started = false;
  let canceled = false;
  let voiceTimeout;
  const start = () => {
    if (started || canceled) return;
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
  } else {
    window.speechSynthesis.onvoiceschanged = start;
    voiceTimeout = window.setTimeout(start, 800);
  }

  return () => {
    canceled = true;
    if (voiceTimeout) window.clearTimeout(voiceTimeout);
    if (window.speechSynthesis.onvoiceschanged === start) window.speechSynthesis.onvoiceschanged = null;
    window.speechSynthesis.cancel();
  };
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
  const cancelActiveSpeech = useRef(null);
  const speechRequestId = useRef(0);
  const [chats, setChats] = useState(initialChats.current);
  const [activeChatId, setActiveChatId] = useState(initialChats.current[0].id);
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [status, setStatus] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [listeningMode, setListeningMode] = useState(null);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [handsFree, setHandsFree] = useState(() => window.localStorage.getItem(handsFreeStorageKey) === "true");
  const [voiceCommandQueue, setVoiceCommandQueue] = useState([]);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [availableActions, setAvailableActions] = useState([]);
  const recognition = useRef(null);
  const handsFreeRef = useRef(handsFree);
  const isRunningRef = useRef(isRunning);
  const isSpeakingRef = useRef(isSpeaking);
  const pendingQuestionRef = useRef(pendingQuestion);
  const sendRequestRef = useRef(null);
  const answerQuestionRef = useRef(null);

  const activeChat = chats.find(({ id }) => id === activeChatId) || chats[0];
  const messages = activeChat?.messages || [];
  const activities = activeChat?.activities || [];
  const voiceSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => { handsFreeRef.current = handsFree; }, [handsFree]);
  useEffect(() => { isRunningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  useEffect(() => { pendingQuestionRef.current = pendingQuestion; }, [pendingQuestion]);

  useEffect(() => () => {
    handsFreeRef.current = false;
    socket.current?.close();
    recognition.current?.abort?.();
    cancelActiveSpeech.current?.();
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
          messages: canonicalMessages.map(({ role, content, action, actions }) => ({
            actor: role === "assistant" ? "Atto" : "user",
            message: content,
            action: action || null,
            actions: actions || (action ? [action] : []),
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

  const addAssistantMessage = (message, shouldSpeak = true, action = null, actions = []) => {
    updateActiveChat((chat) => ({
      ...chat,
      messages: [...chat.messages, { actor: "Atto", message, action, actions: actions.length ? actions : (action ? [action] : []) }],
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
      addAssistantMessage(event.message, true, event.action, event.actions || []);
      if (event.action?.operation === "repeat") {
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
    cancelActiveSpeech.current?.();
    const requestId = speechRequestId.current + 1;
    speechRequestId.current = requestId;
    cancelActiveSpeech.current = speak(message, language(), {
      retainUtterance: (utterance) => { activeUtterance.current = utterance; },
      onStart: () => {
        if (requestId !== speechRequestId.current) return;
        setIsSpeaking(true);
        if (showStatus && requestId === speechRequestId.current) setStatus("Lendo a resposta em voz alta...");
      },
      onEnd: () => {
        if (requestId !== speechRequestId.current) return;
        activeUtterance.current = null;
        cancelActiveSpeech.current = null;
        setIsSpeaking(false);
        if (showStatus) setStatus("");
      },
      onError: (messageError) => {
        if (requestId !== speechRequestId.current || messageError.includes("canceled")) return;
        setIsSpeaking(false);
        setStatus(messageError);
      },
    });
  };

  const stopSpeech = () => {
    speechRequestId.current += 1;
    cancelActiveSpeech.current?.();
    cancelActiveSpeech.current = null;
    activeUtterance.current = null;
    setIsSpeaking(false);
    setStatus((current) => current === "Lendo a resposta em voz alta..." ? "" : current);
  };

  const speakMessage = (message) => {
    setVoiceEnabled(true);
    playSpeech(message, true);
  };

  const sendRequest = async (messageOverride = null) => {
    const message = messageOverride === null ? input.trim() : String(messageOverride).trim();
    if ((!message && !attachment) || isRunning) return;
    let media = null;
    if (attachment) {
      try {
        const uploaded = await uploadChatMedia(attachment);
        media = { ...uploaded, file: attachment };
      } catch (reason) {
        setStatus(reason.message);
        return;
      }
    }
    const displayMessage = message || `Mídia anexada: ${attachment.name}`;

    updateActiveChat((chat) => ({
      ...chat,
      title: chat.title === "Nova conversa" ? displayMessage.slice(0, 36) : chat.title,
      messages: [...chat.messages, { actor: "user", message: displayMessage, media }],
      activities: [...chat.activities, { id: `${Date.now()}-request`, at: new Date(), icon: "●", title: "Nova solicitação", detail: displayMessage, state: "active" }],
    }));
    setInput("");
    setAttachment(null);
    setStatus(language().toLowerCase().startsWith("pt") ? "Conectando ao agent..." : "Connecting to the agent...");
    setIsRunning(true);
    socket.current = connectToAgent({
      input: message || `Analise a mídia anexada: ${attachment.name}`,
      language: language(),
      sessionId: activeChat.sessionId,
      onEvent: handleAgentEvent,
      onError: () => addAssistantMessage("Não foi possível conectar ao agent."),
      onClose: () => setIsRunning(false),
    });
  };

  const resendMessage = (message) => {
    if (!message || isRunning) return;
    sendRequest(message);
  };

  const rerunAction = (action) => {
    if (isRunning || !action?.operation) return;
    const isMessageRerun = action.operation === "rerun_message";
    const isJobStatus = action.operation === "get_development_job";
    if (isMessageRerun && !action.request_id) return;
    if (isJobStatus && !action.job_id) return;
    if (!isMessageRerun && !action.name) return;
    const label = isMessageRerun ? "solicitação" : action.name;
    const message = isMessageRerun
      ? "Rerun da solicitação anterior"
      : isJobStatus ? `Consultar job ${action.job_id}` : `Reexecutar: ${action.name}`;
    updateActiveChat((chat) => ({
      ...chat,
      messages: [...chat.messages, { actor: "user", message }],
      activities: [...chat.activities, { id: `${Date.now()}-rerun`, at: new Date(), icon: "↻", title: "Reexecutando ação", detail: label, state: "active" }],
    }));
    setStatus("Conectando ao agent...");
    setIsRunning(true);
    socket.current = connectToAgent({
      input: message,
      language: language(),
      sessionId: activeChat.sessionId,
      command: isMessageRerun
        ? { operation: "rerun_message", request_id: action.request_id }
        : isJobStatus
          ? { operation: "get_development_job", job_id: action.job_id }
          : { operation: "repeat", action_name: action.name },
      onEvent: handleAgentEvent,
      onError: () => addAssistantMessage("Não foi possível conectar ao agent."),
      onClose: () => setIsRunning(false),
    });
  };

  const startListening = (mode = "dictation", restarting = false) => {
    if (isListening && !restarting) {
      if (listeningMode !== mode) {
        recognition.current?.abort?.();
        window.setTimeout(() => startListening(mode, true), 120);
      } else recognition.current?.stop?.();
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus("O ditado por voz não é compatível com este navegador.");
      return;
    }

    const instance = new SpeechRecognition();
    instance.lang = language();
    instance.continuous = mode === "hands-free";
    instance.interimResults = true;
    instance.maxAlternatives = 1;
    instance.onstart = () => {
      setIsListening(true);
      setListeningMode(mode);
      setVoiceTranscript("");
      setStatus(mode === "hands-free" ? "Mãos livres ativo · diga “Atto” e o seu pedido." : "Ouvindo... envie sua mensagem ao terminar de falar.");
    };
    instance.onresult = (event) => {
      let interim = "";
      const finals = [];
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) finals.push(transcript);
        else interim += `${transcript} `;
      }
      setVoiceTranscript(interim.trim() || finals.join(" "));
      finals.forEach((transcript) => {
        const command = voiceCommandFromTranscript(transcript, mode);
        if (!command) return;
        if (isSpeakingRef.current) stopSpeech();
        setInput(command);
        setVoiceCommandQueue((current) => [...current, command]);
        setStatus(isRunningRef.current ? `Pedido na fila: “${command}”` : "Pedido de voz recebido.");
        if (mode === "dictation") instance.stop();
      });
    };
    instance.onerror = (event) => {
      if (event.error === "no-speech" && mode === "hands-free") return;
      if (["not-allowed", "service-not-allowed"].includes(event.error)) {
        setHandsFree(false);
        handsFreeRef.current = false;
        window.localStorage.setItem(handsFreeStorageKey, "false");
      }
      setStatus("Não foi possível captar o áudio. Verifique a permissão do microfone.");
    };
    instance.onend = () => {
      setIsListening(false);
      setListeningMode(null);
      setVoiceTranscript("");
      if (mode === "hands-free" && handsFreeRef.current && !isSpeakingRef.current) {
        window.setTimeout(() => startListening("hands-free", true), 450);
      }
    };
    recognition.current = instance;
    try { instance.start(); }
    catch { if (!restarting) setStatus("O microfone já está inicializando."); }
  };

  const toggleHandsFree = () => {
    if (!voiceSupported) {
      setStatus("O modo mãos livres não é compatível com este navegador.");
      return;
    }
    const next = !handsFree;
    setHandsFree(next);
    handsFreeRef.current = next;
    window.localStorage.setItem(handsFreeStorageKey, String(next));
    recognition.current?.abort?.();
    if (next) window.setTimeout(() => startListening("hands-free", true), 100);
    else {
      setIsListening(false);
      setListeningMode(null);
      setStatus("");
    }
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
      setIsRunning(true);
      setStatus(language().toLowerCase().startsWith("pt") ? "Enviando sua decisão ao agent..." : "Sending your decision to the agent...");
    }
  };

  sendRequestRef.current = sendRequest;
  answerQuestionRef.current = answerQuestion;

  useEffect(() => {
    if (!voiceCommandQueue.length || isRunning) return;
    const command = voiceCommandQueue[0];
    setVoiceCommandQueue((current) => current.slice(1));
    if (pendingQuestionRef.current) answerQuestionRef.current?.(command);
    else sendRequestRef.current?.(command);
  }, [isRunning, voiceCommandQueue]);

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
    attachment,
    setAttachment,
    messages,
    status,
    isRunning,
    pendingQuestion,
    handleInput,
    sendRequest,
    resendMessage,
    answerQuestion,
    isListening,
    listeningMode,
    voiceTranscript,
    voiceSupported,
    handsFree,
    toggleHandsFree,
    queuedVoiceCommand: voiceCommandQueue[0] || "",
    queuedVoiceCount: voiceCommandQueue.length,
    startListening,
    activities,
    voiceEnabled,
    setVoiceEnabled: (enabled) => {
      setVoiceEnabled(enabled);
      if (!enabled) stopSpeech();
    },
    isSpeaking,
    stopSpeech,
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
