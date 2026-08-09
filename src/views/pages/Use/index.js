import { Layout } from "views/components";

import { useUse } from "./useUse";
import "./index.css";

export const Use = () => {
  const {
    input, messages, status, isRunning, pendingQuestion,
    isListening, handleInput, sendRequest, answerQuestion, startListening,
    activities, voiceEnabled, setVoiceEnabled,
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
          <section className="conversation-panel" aria-label="Conversa com o Atto">
            <div className="panel-heading"><div><span className="eyebrow">CONVERSA</span><h2>Seu pedido, do início ao resultado</h2></div><button className={`voice-toggle${voiceEnabled ? " enabled" : ""}`} type="button" onClick={() => setVoiceEnabled(!voiceEnabled)} aria-pressed={voiceEnabled}>⌁ Voz {voiceEnabled ? "ligada" : "desligada"}</button></div>
            <div className="chat-history" aria-live="polite">
              {messages.map(({ actor, message }, currentIndex) => (
                <article key={`${actor}-${currentIndex}`} className={`message ${actor === "Atto" ? "message-agent" : "message-user"}`}>
                  <span className="message-author">{actor === "Atto" ? "ATTO" : "VOCÊ"}</span>
                  <p>{message}</p>
                </article>
              ))}
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
              {activities.length === 0 ? <div className="roadmap-empty"><span>◎</span><p>Envie um pedido para acompanhar cada etapa da execução.</p></div> : activities.map((activity, index) => <div className={`roadmap-item ${activity.state}`} key={activity.id}><div className="roadmap-marker">{activity.icon}</div><div><div className="roadmap-title-row"><strong>{activity.title}</strong><time>{activity.at.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time></div><p>{activity.detail}</p></div>{index < activities.length - 1 && <i />}</div>)}
            </div>
          </aside>
        </section>
      </main>
    </Layout>
  );
};
