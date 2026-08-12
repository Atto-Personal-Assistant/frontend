import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

import "./index.css";

export const DesktopTitlebar = () => {
  const [desktop, setDesktop] = useState(false);
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const isTauri = typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
    setDesktop(isTauri);
    if (!isTauri) return undefined;
    document.documentElement.dataset.attoDesktop = "true";

    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized).catch(() => {});
    return () => { delete document.documentElement.dataset.attoDesktop; };
  }, []);

  if (!desktop) return null;

  const appWindow = getCurrentWindow();
  const toggleMaximize = async () => {
    await appWindow.toggleMaximize();
    setMaximized(await appWindow.isMaximized());
  };

  return (
    <header className="desktop-titlebar" data-tauri-drag-region>
      <span className="desktop-titlebar-brand">ATTO</span>
      <div className="desktop-window-controls">
        <button type="button" onClick={() => appWindow.minimize()} aria-label="Minimizar">−</button>
        <button type="button" onClick={toggleMaximize} aria-label={maximized ? "Restaurar" : "Maximizar"}>{maximized ? "❐" : "□"}</button>
        <button type="button" className="desktop-close" onClick={() => appWindow.close()} aria-label="Fechar">×</button>
      </div>
    </header>
  );
};
