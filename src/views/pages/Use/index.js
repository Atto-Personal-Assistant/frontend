import { Layout } from "views/components";
import React from "react";
import { Config } from "application/constants";
import { listDevices, sendDeviceCommand, uploadDeviceMedia } from "infrastructure/services/devices";

import { useUse } from "./useUse";
import "./index.css";

const InlineMarkdown = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<]+)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
      if (/^https?:\/\//.test(part)) {
        const trailing = part.match(/[),.;!?]+$/)?.[0] || "";
        const url = trailing ? part.slice(0, -trailing.length) : part;
        return <React.Fragment key={index}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{trailing}</React.Fragment>;
      }
      return <React.Fragment key={index}>{part}</React.Fragment>;
    })}
  </>
);

const MarkdownMessage = ({ message }) => {
  const lines = message.split("\n");
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const Tag = `h${heading[1].length + 2}`;
      blocks.push(<Tag key={index}><InlineMarkdown text={heading[2]} /></Tag>);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(<li key={index}><InlineMarkdown text={lines[index].replace(/^[-*]\s+/, "")} /></li>);
        index += 1;
      }
      index -= 1;
      blocks.push(<ul key={`list-${index}`}>{items}</ul>);
      continue;
    }
    blocks.push(<p key={index}><InlineMarkdown text={line} /></p>);
  }

  return <div className="markdown-message">{blocks}</div>;
};

export const Use = () => {
  const chatHistoryRef = React.useRef(null);
  const [showLatestButton, setShowLatestButton] = React.useState(false);
  const [sharedContent, setSharedContent] = React.useState(null);
  const [shareTarget, setShareTarget] = React.useState(null);
  const [shareDevices, setShareDevices] = React.useState([]);
  const [shareError, setShareError] = React.useState("");
  const [shareFile, setShareFile] = React.useState(null);
  const {
    input, setAttachment, messages, status, isRunning, pendingQuestion,
    isListening, handleInput, sendRequest, resendMessage, answerQuestion, startListening,
    voiceEnabled, setVoiceEnabled, isSpeaking, stopSpeech,
    copiedMessageId, copyMessage, speakMessage, rerunAction, availableActions,
    chats, activeChatId, createNewChat, selectChat, deleteChat,
  } = useUse();
  React.useEffect(() => {
    const deviceId = window.localStorage.getItem("atto.active-device");
    const deviceToken = window.localStorage.getItem("atto.device-token");
    if (!deviceId || !deviceToken) return undefined;
    const base = new URL(Config.STAGE.BASE_URL);
    const socketUrl = `${base.protocol === "https:" ? "wss:" : "ws:"}//${base.host}/devices/${encodeURIComponent(deviceId)}/events?token=${encodeURIComponent(deviceToken)}`;
    let socket;
    let reconnectTimer;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      try {
        socket = new WebSocket(socketUrl);
        socket.onmessage = (event) => {
          try {
            const command = JSON.parse(event.data);
            if (["share_content", "view_content", "view_media"].includes(command.action)) setSharedContent({ ...(command.payload || {}), sender: command.sender, media: command.action === "view_media" });
          } catch { /* Ignore malformed device events. */ }
        };
        socket.onclose = () => {
          if (!stopped) reconnectTimer = window.setTimeout(connect, 3000);
        };
        socket.onerror = () => socket.close();
      } catch {
        reconnectTimer = window.setTimeout(connect, 3000);
      }
    };

    connect();
    return () => {
      stopped = true;
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);
  const openShare = async (content) => {
    setShareError("");
    try { const result = await listDevices(); setShareDevices(result.devices || []); setShareTarget(content); }
    catch (reason) { setShareError(reason.message); }
  };
  const shareTo = async (device) => {
    try { if (shareFile) await uploadDeviceMedia(device.id, shareFile, shareTarget.title); else await sendDeviceCommand(device.id, "view_content", shareTarget); setShareTarget(null); setShareFile(null); }
    catch (reason) { setShareError(reason.message); }
  };
  const [historyVisible, setHistoryVisible] = React.useState(
    () => typeof window !== "undefined" && !window.matchMedia("(max-width: 700px)").matches,
  );

  const chooseChat = (chatId) => {
    selectChat(chatId);
    if (window.matchMedia("(max-width: 700px)").matches) setHistoryVisible(false);
  };

  const removeChat = async (chatId) => {
    await deleteChat(chatId);
    if (window.matchMedia("(max-width: 700px)").matches) setHistoryVisible(false);
  };

  const submit = (event) => {
    event.preventDefault();
    if (pendingQuestion) answerQuestion(input);
    else sendRequest();
  };

  const updateScrollAffordance = () => {
    const element = chatHistoryRef.current;
    if (!element) return;
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.actor === "user") {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      setShowLatestButton(false);
      return;
    }
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    setShowLatestButton(distanceFromBottom > 120);
  };

  const scrollToLatest = () => {
    const element = chatHistoryRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    setShowLatestButton(false);
  };

  React.useEffect(() => {
    const element = chatHistoryRef.current;
    if (!element) return undefined;
    element.addEventListener("scroll", updateScrollAffordance, { passive: true });
    updateScrollAffordance();
    return () => element.removeEventListener("scroll", updateScrollAffordance);
  }, [activeChatId]);

  React.useEffect(() => {
    const element = chatHistoryRef.current;
    if (!element) return;
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (distanceFromBottom < 180) {
      element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
      setShowLatestButton(false);
    } else {
      setShowLatestButton(true);
    }
  }, [messages.length, status]);

  return (
    <Layout>
      <main className="agent-workspace">
        {sharedContent && <div className="shared-content-backdrop"><section className="shared-content-banner" role="dialog" aria-modal="true"><button type="button" onClick={() => setSharedContent(null)}>×</button><span>Compartilhado por {sharedContent.sender?.name || "um dispositivo"}</span><h2>{sharedContent.title || "Atto"}</h2>{sharedContent.media ? <>{sharedContent.media_type?.startsWith("image/") && <img className="shared-media" src={`${Config.STAGE.BASE_URL}${sharedContent.url}`} alt={sharedContent.title} />}{sharedContent.media_type?.startsWith("video/") && <video className="shared-media" src={`${Config.STAGE.BASE_URL}${sharedContent.url}`} controls />}{sharedContent.media_type?.startsWith("audio/") && <audio src={`${Config.STAGE.BASE_URL}${sharedContent.url}`} controls />}</> : <p>{sharedContent.content}</p>}</section></div>}
        {shareTarget && <div className="share-modal-backdrop" role="presentation"><section className="share-modal" role="dialog" aria-modal="true"><button className="share-modal-close" type="button" onClick={() => { setShareTarget(null); setShareFile(null); }}>×</button><span className="eyebrow">COMPARTILHAR</span><h2>Enviar para qual dispositivo?</h2><input type="file" accept="image/*,video/*,audio/*" onChange={(event) => setShareFile(event.target.files?.[0] || null)} />{shareFile && <p className="share-file-name">{shareFile.name}</p>}{shareError && <p className="share-error">{shareError}</p>}<div className="share-device-list">{shareDevices.map((device) => <button type="button" key={device.id} onClick={() => shareTo(device)}><span className="share-device-avatar">{device.name.slice(0, 1).toUpperCase()}</span><span><strong>{device.name}</strong><small>{device.online ? "Online" : "Online quando conectar"}</small></span></button>)}</div></section></div>}
        <header className="agent-hero">
          <div className="agent-brand"><span className="agent-orb">A</span><div><span className="eyebrow">ATTO AGENT</span><h1>Central de execução</h1></div></div>
          <div className={`agent-presence${isRunning ? " is-running" : ""}`}><span />{isRunning ? "Trabalhando" : "Pronto para ajudar"}</div>
        </header>

        <section className={`agent-grid${historyVisible ? "" : " history-hidden"}`}>
          {historyVisible && <button type="button" className="history-backdrop" onClick={() => setHistoryVisible(false)} aria-label="Fechar histórico" />}
          <aside id="conversation-history" className={`chat-list-panel${historyVisible ? " is-open" : ""}`} aria-label="Histórico de conversas" aria-hidden={!historyVisible}>
            <div className="chat-list-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Conversas</h2></div><div className="chat-list-heading-actions"><button type="button" onClick={createNewChat} disabled={isRunning} title="Nova conversa" aria-label="Nova conversa">＋</button><button type="button" className="history-close" onClick={() => setHistoryVisible(false)} title="Ocultar histórico" aria-label="Ocultar histórico">‹</button></div></div>
            <div className="chat-list">
              {chats.map((chat) => <div key={chat.id} className={`chat-list-item${chat.id === activeChatId ? " selected" : ""}`}>
                <button type="button" className="chat-list-select" onClick={() => chooseChat(chat.id)} disabled={isRunning}>
                  <strong>{chat.title}</strong><span>{new Date(chat.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </button>
                <button type="button" className="chat-list-delete" onClick={() => removeChat(chat.id)} disabled={isRunning} title={`Excluir ${chat.title}`} aria-label={`Excluir conversa ${chat.title}`}>×</button>
              </div>)}
            </div>
          </aside>
          <section className="conversation-panel" aria-label="Conversa com o Atto">
            <div className="panel-heading"><div className="conversation-heading"><button type="button" className="history-toggle" onClick={() => setHistoryVisible(!historyVisible)} aria-expanded={historyVisible} aria-controls="conversation-history" title={historyVisible ? "Ocultar histórico" : "Mostrar histórico"}>☰</button><div><span className="eyebrow">CONVERSA</span><h2>Seu pedido, do início ao resultado</h2></div></div><div className="conversation-actions">{availableActions.map((action) => { const isJob = action.operation === "get_development_job"; const label = isJob ? "Consultar job" : "Reexecutar ação"; return <button key={action.name} type="button" className="rerun-action" onClick={() => rerunAction(action)} disabled={isRunning} title={`${label}: ${action.name}`} aria-label={`${label}: ${action.name}`}>{isJob ? "◌" : "↻"}</button>; })}<button className={`voice-toggle${voiceEnabled ? " enabled" : ""}`} type="button" onClick={() => setVoiceEnabled(!voiceEnabled)} aria-pressed={voiceEnabled} title={voiceEnabled ? "Desligar voz" : "Ligar voz"} aria-label={voiceEnabled ? "Desligar voz" : "Ligar voz"}>⌁</button></div></div>
            <div ref={chatHistoryRef} className="chat-history" aria-live="polite">
              {messages.map(({ actor, message, media, action, actions = [] }, currentIndex) => {
                const messageId = `${actor}-${currentIndex}`;
                return (
                <article key={`${actor}-${currentIndex}`} className={`message ${actor === "Atto" ? "message-agent" : "message-user"}`}>
                  <span className="message-author">{actor === "Atto" ? "ATTO" : "VOCÊ"}</span>
                  <MarkdownMessage message={message} />
                  {media?.media_type?.startsWith("image/") && <img className="chat-media-preview" src={`${Config.STAGE.BASE_URL}${media.url}`} alt={media.name} />}
                  {media?.media_type?.startsWith("video/") && <video className="chat-media-preview" src={`${Config.STAGE.BASE_URL}${media.url}`} controls />}
                  {media?.media_type?.startsWith("audio/") && <audio src={`${Config.STAGE.BASE_URL}${media.url}`} controls />}
                  {(actor === "Atto" || actor === "user" || media) && <div className="message-actions">
                    {actor === "user" && <><button type="button" onClick={() => resendMessage(message)} disabled={isRunning} title="Re-enviar mensagem" aria-label="Re-enviar mensagem">↻</button>
                    <button type="button" onClick={() => copyMessage(messageId, message)} title={copiedMessageId === messageId ? "Mensagem copiada" : "Copiar mensagem"} aria-label={copiedMessageId === messageId ? "Mensagem copiada" : "Copiar mensagem"}>{copiedMessageId === messageId ? "✓" : "⧉"}</button></>}
                    {actor === "Atto" && <><button type="button" className={isSpeaking ? "stop-speech" : ""} onClick={() => isSpeaking ? stopSpeech() : speakMessage(message)} title={isSpeaking ? "Parar áudio" : "Ler em voz alta"} aria-label={isSpeaking ? "Parar áudio" : "Ler em voz alta"}>{isSpeaking ? "⏹" : "🔊"}</button>
                    <button type="button" onClick={() => copyMessage(messageId, message)} title={copiedMessageId === messageId ? "Resposta copiada" : "Copiar resposta"} aria-label={copiedMessageId === messageId ? "Resposta copiada" : "Copiar resposta"}>{copiedMessageId === messageId ? "✓" : "⧉"}</button></>}
                    <button type="button" onClick={() => { setShareFile(media?.file || null); openShare({ title: actor === "Atto" ? "Mensagem do Atto" : "Mídia anexada", content: message }); }} title="Compartilhar mensagem" aria-label="Compartilhar mensagem">↗</button>
                    {actor === "Atto" && (actions.length ? actions : (action ? [action] : [])).map((messageAction) => (
                      <button key={`${messageAction.operation}-${messageAction.name}`} type="button" onClick={() => rerunAction(messageAction)} disabled={isRunning} title={messageAction.name} aria-label={messageAction.name}>
                        {messageAction.operation === "get_development_job" ? "◌" : "↻"}
                      </button>
                    ))}
                  </div>}
                </article>
                );
              })}
              {status && <div className="chat-status"><span />{status}</div>}
              {pendingQuestion?.options?.length > 0 && <div className="chat-options">{pendingQuestion.options.map((option) => <button key={option} onClick={() => answerQuestion(option)}>{option}</button>)}</div>}
              {showLatestButton && <button type="button" className="scroll-latest" onClick={scrollToLatest} aria-label="Ir para a mensagem mais recente" title="Ir para a mensagem mais recente">↓ Mensagem mais recente</button>}
            </div>
            <form className="chat-request" onSubmit={submit}>
              <input value={input} onChange={handleInput} className="chat-request-input" placeholder={pendingQuestion ? "Digite sua decisão..." : "Descreva o que você quer fazer..."} disabled={isRunning && !pendingQuestion} />
              <label className="chat-attach" title="Anexar mídia">＋<input type="file" accept="image/*,video/*,audio/*" onChange={(event) => setAttachment(event.target.files?.[0] || null)} /></label>
              <button type="button" className={`chat-request-audio${isListening ? " is-listening" : ""}`} onClick={startListening} disabled={isRunning && !pendingQuestion} aria-label={isListening ? "Parar ditado por voz" : "Ditar por voz"} title={isListening ? "Ouvindo..." : "Ditar por voz"}>🎙</button>
              <button className="chat-request-send" disabled={isRunning && !pendingQuestion} aria-label="Enviar mensagem">{pendingQuestion ? "✓" : "↑"}</button>
            </form>
            <p className="input-hint">Use o microfone para ditar sua mensagem. O Atto responde por texto e voz.</p>
          </section>
        </section>
      </main>
    </Layout>
  );
};
