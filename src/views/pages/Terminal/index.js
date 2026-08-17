import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "views/components";
import {
  openTerminal,
  closeTerminal,
  setClipboard,
  getClipboard,
} from "infrastructure/services/terminal";
import TerminalView from "./TerminalView";
import "./terminal.css";

const TerminalPage = () => {
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [clipboardText, setClipboardText] = useState("");
  const [showClipboard, setShowClipboard] = useState(false);
  const navigate = useNavigate();

  const startTerminal = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await openTerminal();
      setSessionId(result.session_id);
    } catch (err) {
      setError(err.message || "Erro ao abrir terminal.");
    } finally {
      setLoading(false);
    }
  }, []);

  const stopTerminal = useCallback(async () => {
    if (!sessionId) return;
    try {
      await closeTerminal(sessionId);
    } catch (_) {
      // session may already be dead
    }
    setSessionId(null);
  }, [sessionId]);

  const handleDisconnect = useCallback(() => {
    setSessionId(null);
  }, []);

  const syncClipboard = useCallback(async () => {
    try {
      const { text } = await getClipboard();
      setClipboardText(text || "");
    } catch (_) {}
  }, []);

  const pushClipboard = useCallback(async () => {
    try {
      await setClipboard(clipboardText);
    } catch (_) {}
  }, [clipboardText]);

  return (
    <Layout>
      <main className="terminal-page">
        <div className="terminal-header">
          <div className="terminal-header-left">
            <h1 className="terminal-title">Terminal Remoto</h1>
          </div>
          <div className="terminal-header-right">
            {sessionId && (
              <>
                <span className="terminal-session-badge">Sessao ativa</span>
                <button
                  className="terminal-btn terminal-btn-clipboard"
                  type="button"
                  onClick={() => {
                    setShowClipboard(!showClipboard);
                    if (!showClipboard) syncClipboard();
                  }}
                >
                  Clipboard
                </button>
              </>
            )}
            {sessionId ? (
              <button
                className="terminal-btn terminal-btn-close"
                type="button"
                onClick={stopTerminal}
              >
                Fechar
              </button>
            ) : (
              <button
                className="terminal-btn terminal-btn-open"
                type="button"
                onClick={startTerminal}
                disabled={loading}
              >
                {loading ? "Abrindo..." : "Abrir Terminal"}
              </button>
            )}
          </div>
        </div>
        {showClipboard && (
          <div className="terminal-clipboard-bar">
            <textarea
              className="terminal-clipboard-input"
              value={clipboardText}
              onChange={(e) => setClipboardText(e.target.value)}
              placeholder="Cole texto aqui para enviar ao servidor..."
              rows={2}
            />
            <div className="terminal-clipboard-actions">
              <button type="button" onClick={pushClipboard}>
                Enviar ao servidor
              </button>
              <button type="button" onClick={syncClipboard}>
                Ler do servidor
              </button>
              <button type="button" onClick={() => setShowClipboard(false)}>
                Fechar
              </button>
            </div>
          </div>
        )}
        {error && <p className="terminal-error">{error}</p>}
        {sessionId ? (
          <TerminalView sessionId={sessionId} onDisconnect={handleDisconnect} />
        ) : (
          <div className="terminal-placeholder">
            <div className="terminal-placeholder-icon">&gt;_</div>
            <p>Clique em "Abrir Terminal" para iniciar uma sessao remota.</p>
            <p className="terminal-placeholder-hint">
              O terminal sera executado no servidor e voce podera interagir em
              tempo real.
            </p>
            <p className="terminal-shortcut-hint">
              Ctrl+Shift+C copia para o clipboard compartilhado.
              <br />
              Ctrl+Shift+V cola do clipboard compartilhado.
            </p>
          </div>
        )}
      </main>
    </Layout>
  );
};

export default TerminalPage;
