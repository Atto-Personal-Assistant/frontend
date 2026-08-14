import React from "react";
import Routes from "routes";
import { openRemoteCameraStream, sendDeviceCommand, startLocalAttoNode, stopBrowserCamera } from "infrastructure/services/devices";

import { DesktopTitlebar } from "views/components/DesktopTitlebar";

import "views/styles/globalStyles.css";

const CameraPreview = ({ stream, dataUrl, onClose }) => {
  const video = React.useRef(null);
  const windowRef = React.useRef(null);
  const drag = React.useRef(null);
  const [minimized, setMinimized] = React.useState(false);
  const [position, setPosition] = React.useState(() => ({
    x: Math.max(12, window.innerWidth - 352),
    y: Math.max(72, window.innerHeight - 320),
  }));

  React.useEffect(() => {
    const element = video.current;
    if (element && stream) element.srcObject = stream;
    return () => { if (element) element.srcObject = null; };
  }, [stream]);

  const startDrag = (event) => {
    if (event.target.closest("button")) return;
    drag.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const bounds = windowRef.current?.getBoundingClientRect();
    const maxX = Math.max(8, window.innerWidth - (bounds?.width || 320) - 8);
    const maxY = Math.max(60, window.innerHeight - (bounds?.height || 220) - 8);
    setPosition({
      x: Math.min(maxX, Math.max(8, drag.current.originX + event.clientX - drag.current.startX)),
      y: Math.min(maxY, Math.max(60, drag.current.originY + event.clientY - drag.current.startY)),
    });
  };
  const stopDrag = (event) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  };

  return <aside ref={windowRef} className={`atto-camera-preview${minimized ? " minimized" : ""}`} style={{ left: position.x, top: position.y }} aria-label="Câmera ativa">
    <header onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onDoubleClick={() => setMinimized(!minimized)}>
      <span><i /> Câmera ativa</span>
      <div className="camera-window-actions">
        <button type="button" onClick={() => setMinimized(!minimized)} aria-label={minimized ? "Restaurar câmera" : "Minimizar câmera"} title={minimized ? "Restaurar" : "Minimizar"}>{minimized ? "□" : "−"}</button>
        <button type="button" className="camera-close" onClick={onClose} aria-label="Fechar câmera" title="Fechar câmera">×</button>
      </div>
    </header>
    {!minimized && <>{dataUrl ? <img src={dataUrl} alt="Imagem capturada pela câmera remota" /> : <video ref={video} autoPlay muted playsInline />}<small>Arraste para mover · redimensione pelo canto</small></>}
  </aside>;
};

const App = () => {
  const [cameraStream, setCameraStream] = React.useState(null);
  const [remoteCameraFrame, setRemoteCameraFrame] = React.useState(null);
  const [remoteCameraDeviceId, setRemoteCameraDeviceId] = React.useState(null);
  const [remoteCameraStream, setRemoteCameraStream] = React.useState(null);

  React.useEffect(() => {
    const updateCamera = ({ detail }) => setCameraStream(detail?.stream || null);
    window.addEventListener("atto:camera-state", updateCamera);
    const updateRemoteCamera = ({ detail }) => {
      setRemoteCameraFrame(detail?.dataUrl || null);
      setRemoteCameraDeviceId(detail?.deviceId || null);
    };
    window.addEventListener("atto:remote-camera-frame", updateRemoteCamera);
    return () => {
      window.removeEventListener("atto:camera-state", updateCamera);
      window.removeEventListener("atto:remote-camera-frame", updateRemoteCamera);
    };
  }, []);

  React.useEffect(() => {
    if (!remoteCameraDeviceId) return undefined;
    const controller = new AbortController();
    let peer;
    openRemoteCameraStream(remoteCameraDeviceId, {
      signal: controller.signal,
      onStream: (stream) => { if (!controller.signal.aborted) setRemoteCameraStream(stream); },
    }).then((connection) => { peer = connection; }).catch((error) => {
      if (error.name !== "AbortError") console.warn("Não foi possível abrir o vídeo WebRTC:", error);
    });
    return () => {
      controller.abort();
      peer?.close();
      setRemoteCameraStream(null);
    };
  }, [remoteCameraDeviceId]);

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
    {(cameraStream || remoteCameraFrame || remoteCameraStream) && <CameraPreview stream={remoteCameraStream || cameraStream} dataUrl={remoteCameraStream ? null : remoteCameraFrame} onClose={() => {
      stopBrowserCamera();
      if (remoteCameraDeviceId) sendDeviceCommand(remoteCameraDeviceId, "camera.stop", {}).catch(() => {});
      setRemoteCameraFrame(null);
      setRemoteCameraStream(null);
      setRemoteCameraDeviceId(null);
    }} />}
  </>;
};

export default App;
