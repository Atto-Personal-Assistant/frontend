import { Layout } from "views/components";
import React from "react";

import { useUse } from "./useUse";
import "./index.css";

const InlineMarkdown = ({ text }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
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
  const {
    input, messages, status, isRunning, pendingQuestion,
    isListening, handleInput, sendRequest, answerQuestion, startListening,
    activities, voiceEnabled, setVoiceEnabled,
    copiedMessageId, copyMessage, speakMessage, rerunAction, availableActions,
    chats, activeChatId, createNewChat, selectChat, deleteChat,
  } = useUse();

  const submit = (event) => {
    event.preventDefault();
    if (pendingQuestion) answerQuestion(input);
    else sendRequest();
  };

  return (
    <Layout>
      <main className="agent-workspace">
        <header className="agent-hero">
          <div className="agent-brand"><span className="agent-orb">A</span><div><span className="eyebrow">ATTO AGENT</span><h1>Central de execução</h1></div></div>
          <div className={`agent-presence${isRunning ? " is-running" : ""}`}><span />{isRunning ? "Trabalhando" : "Pronto para ajudar"}</div>
        </header>

        <section className="agent-grid">
          <aside className="chat-list-panel" aria-label="Histórico de conversas">
            <div className="chat-list-heading"><div><span className="eyebrow">HISTÓRICO</span><h2>Conversas</h2></div><button type="button" onClick={createNewChat} disabled={isRunning} title="Nova conversa" aria-label="Nova conversa">＋</button></div>
            <div className="chat-list">
              {chats.map((chat) => <div key={chat.id} className={`chat-list-item${chat.id === activeChatId ? " selected" : ""}`}>
                <button type="button" className="chat-list-select" onClick={() => selectChat(chat.id)} disabled={isRunning}>
                  <strong>{chat.title}</strong><span>{new Date(chat.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                </button>
                <button type="button" className="chat-list-delete" onClick={() => deleteChat(chat.id)} disabled={isRunning} title={`Excluir ${chat.title}`} aria-label={`Excluir conversa ${chat.title}`}>×</button>
              </div>)}
            </div>
          </aside>
          <section className="conversation-panel" aria-label="Conversa com o Atto">
            <div className="panel-heading"><div><span className="eyebrow">CONVERSA</span><h2>Seu pedido, do início ao resultado</h2></div><div className="conversation-actions">{availableActions.map((action) => <button key={action.name} type="button" className="rerun-action" onClick={() => rerunAction(action)} disabled={isRunning} title={`Executar ${action.name} novamente`}>↻ {action.name}</button>)}<button className={`voice-toggle${voiceEnabled ? " enabled" : ""}`} type="button" onClick={() => setVoiceEnabled(!voiceEnabled)} aria-pressed={voiceEnabled}>⌁ Voz {voiceEnabled ? "ligada" : "desligada"}</button></div></div>
            <div className="chat-history" aria-live="polite">
              {messages.map(({ actor, message, action }, currentIndex) => {
                const messageId = `${actor}-${currentIndex}`;
                return (
                <article key={`${actor}-${currentIndex}`} className={`message ${actor === "Atto" ? "message-agent" : "message-user"}`}>
                  <span className="message-author">{actor === "Atto" ? "ATTO" : "VOCÊ"}</span>
                  <MarkdownMessage message={message} />
                  {actor === "Atto" && <div className="message-actions">
                    <button type="button" onClick={() => speakMessage(message)} title="Ler em voz alta" aria-label="Ler em voz alta">🔊</button>
                    <button type="button" onClick={() => copyMessage(messageId, message)} title="Copiar resposta">{copiedMessageId === messageId ? "Copiado" : "Copiar"}</button>
                    {action?.operation === "repeat" && <button type="button" onClick={() => rerunAction(action)} disabled={isRunning} title={`Executar ${action.name} novamente`} aria-label={`Executar ação ${action.name} novamente`}>↻ Rerun</button>}
                  </div>}
                </article>
                );
              })}
              {status && <div className="chat-status"><span />{status}</div>}
              {pendingQuestion?.options?.length > 0 && <div className="chat-options">{pendingQuestion.options.map((option) => <button key={option} onClick={() => answerQuestion(option)}>{option}</button>)}</div>}
            </div>
            <form className="chat-request" onSubmit={submit}>
              <input value={input} onChange={handleInput} className="chat-request-input" placeholder={pendingQuestion ? "Digite sua decisão..." : "Descreva o que você quer fazer..."} disabled={isRunning && !pendingQuestion} />
              <button type="button" className={`chat-request-audio${isListening ? " is-listening" : ""}`} onClick={startListening} disabled={isRunning && !pendingQuestion} aria-label={isListening ? "Parar ditado por voz" : "Ditar por voz"} title={isListening ? "Ouvindo..." : "Ditar por voz"}>🎙</button>
              <button className="chat-request-send" disabled={isRunning && !pendingQuestion} aria-label="Enviar mensagem">{pendingQuestion ? "✓" : "↑"}</button>
            </form>
            <p className="input-hint">Use o microfone para ditar sua mensagem. O Atto responde por texto e voz.</p>
          </section>

          <aside className="roadmap-panel" aria-label="Roadmap da execução">
            <div className="panel-heading"><div><span className="eyebrow">ROADMAP AO VIVO</span><h2>O que o Atto está fazendo</h2></div><span className="activity-count">{activities.length} etapas</span></div>
            <div className="roadmap">
              {activities.length === 0 ? <div className="roadmap-empty"><span>◎</span><p>Envie um pedido para acompanhar cada etapa da execução.</p></div> : activities.map((activity, index) => <div className={`roadmap-item ${activity.state}`} key={activity.id}><div className="roadmap-marker">{activity.icon}</div><div><div className="roadmap-title-row"><strong>{activity.title}</strong><time>{new Date(activity.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{activity.detail}</p></div>{index < activities.length - 1 && <i />}</div>)}
            </div>
          </aside>
        </section>
      </main>
    </Layout>
  );
};
