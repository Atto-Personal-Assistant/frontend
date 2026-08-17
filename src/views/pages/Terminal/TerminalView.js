import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";
import {
  connectTerminalWs,
  resizeTerminal,
  setClipboard,
  getClipboard,
} from "infrastructure/services/terminal";

const TerminalView = ({ sessionId, onDisconnect }) => {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const wsRef = useRef(null);
  const fitAddonRef = useRef(null);

  const cleanup = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      if (wsRef.current.readyState === WebSocket.OPEN) wsRef.current.close();
      wsRef.current = null;
    }
    if (termRef.current) {
      termRef.current.dispose();
      termRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!sessionId || !containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: "#0a0e18",
        foreground: "#c9d1d9",
        cursor: "#58a6ff",
        cursorAccent: "#0a0e18",
        selectionBackground: "rgba(88, 166, 255, 0.3)",
        black: "#0d1117",
        red: "#ff7b72",
        green: "#3fb950",
        yellow: "#d29922",
        blue: "#58a6ff",
        magenta: "#bc8cff",
        cyan: "#39c5cf",
        white: "#c9d1d9",
        brightBlack: "#484f58",
        brightRed: "#ffa198",
        brightGreen: "#56d364",
        brightYellow: "#e3b341",
        brightBlue: "#79c0ff",
        brightMagenta: "#d2a8ff",
        brightCyan: "#56d4dd",
        brightWhite: "#f0f6fc",
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const ws = connectTerminalWs(sessionId);
    wsRef.current = ws;

    ws.onopen = () => {
      term.focus();
      resizeTerminal(sessionId, term.cols, term.rows).catch(() => {});
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.write("\r\n\x1b[33m[Conexao encerrada]\x1b[0m\r\n");
      onDisconnect?.();
    };

    ws.onerror = () => {
      term.write("\r\n\x1b[31m[Erro de conexao]\x1b[0m\r\n");
      onDisconnect?.();
    };

    // Ctrl+Shift+C: copy selection to shared clipboard
    term.attachCustomKeyEventHandler((event) => {
      if (event.ctrlKey && event.shiftKey && event.code === "KeyC" && event.type === "keydown") {
        const selection = term.getSelection();
        if (selection) {
          setClipboard(selection).catch(() => {});
          // Also copy to browser clipboard as fallback
          navigator.clipboard?.writeText(selection).catch(() => {});
        }
        return false;
      }
      // Ctrl+Shift+V: paste from shared clipboard (or browser clipboard)
      if (event.ctrlKey && event.shiftKey && event.code === "KeyV" && event.type === "keydown") {
        event.preventDefault();
        navigator.clipboard
          ?.readText()
          .then((text) => {
            if (text) {
              if (ws.readyState === WebSocket.OPEN) ws.send(text);
              setClipboard(text).catch(() => {});
            }
          })
          .catch(() => {
            // Fallback: try server clipboard
            getClipboard()
              .then(({ text }) => {
                if (text && ws.readyState === WebSocket.OPEN) ws.send(text);
              })
              .catch(() => {});
          });
        return false;
      }
      return true;
    });

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data);
    });

    let resizeTimeout = null;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        fitAddon.fit();
        if (ws.readyState === WebSocket.OPEN) {
          resizeTerminal(sessionId, term.cols, term.rows).catch(() => {});
        }
      }, 150);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(resizeTimeout);
      window.removeEventListener("resize", handleResize);
      cleanup();
    };
  }, [sessionId, onDisconnect, cleanup]);

  return (
    <div className="terminal-view">
      <div ref={containerRef} className="terminal-container" />
    </div>
  );
};

export default TerminalView;
