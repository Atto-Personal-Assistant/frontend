import React from "react";
import Routes from "routes";
import { startLocalAttoNode, stopBrowserCamera } from "infrastructure/services/devices";

import { DesktopTitlebar } from "views/components/DesktopTitlebar";

import "views/styles/globalStyles.css";

const App = () => {
  const [cameraStream, setCameraStream] = React.useState(null);
  const cameraPreview = React.useRef(null);

  React.useEffect(() => {
    const updateCamera = ({ detail }) => setCameraStream(detail?.stream || null);
    window.addEventListener("atto:camera-state", updateCamera);
    return () => window.removeEventListener("atto:camera-state", updateCamera);
  }, []);

  React.useEffect(() => {
    if (cameraPreview.current) cameraPreview.current.srcObject = cameraStream;
  }, [cameraStream]);

  React.useEffect(() => {
    let node;
    let cancelled = false;
    console.info("Atto Node: iniciando dispositivo local");
    startLocalAttoNode()
      .then((started) => {
        if (cancelled) started.stop();
        else {
          node = started;
          console.info("Atto Node: conectado", started.device);
        }
      })
      .catch((error) => {
        console.warn("Atto Node não iniciou:", error);
        window.dispatchEvent(new CustomEvent("atto:node-error", { detail: error }));
      });
    return () => {
      cancelled = true;
      node?.stop();
      stopBrowserCamera();
    };
  }, []);

  return <>
    <DesktopTitlebar />
    <Routes />
    {cameraStream && <aside className="atto-camera-preview" aria-label="Câmera ativa">
      <header><span><i /> Câmera ativa</span><button type="button" onClick={stopBrowserCamera} aria-label="Fechar câmera" title="Fechar câmera">×</button></header>
      <video ref={cameraPreview} autoPlay muted playsInline />
      <small>Continue conversando com o Atto normalmente.</small>
    </aside>}
  </>;
};

export default App;
