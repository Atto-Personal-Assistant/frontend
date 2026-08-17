import { useEffect, useState } from "react";
import { listDevices, registerDevice, renameDevice } from "infrastructure/services/devices";
import { activateDevice } from "infrastructure/services/devices";
import { useNavigate } from "react-router-dom";
import "./index.css";

export const Devices = () => {
  const [devices, setDevices] = useState([]);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [showOffline, setShowOffline] = useState(false);

  const refresh = () => listDevices().then((data) => setDevices(data.devices || [])).catch((reason) => setError(reason.message));
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => window.clearInterval(timer);
  }, []);

  const save = async (device) => {
    try {
      const result = await renameDevice(device.id, name.trim());
      setDevices((current) => current.map((item) => item.id === device.id ? result.device : item));
      setEditing(null);
    } catch (reason) { setError(reason.message); }
  };

  const keepEditing = (event) => event.stopPropagation();

  const addDevice = async () => {
    if (!newName.trim()) return;
    try {
      const result = await registerDevice({ name: newName.trim() });
      setDevices((current) => [...current, result.device]);
      if (result.device_token) {
        localStorage.setItem(`atto.device-token:${result.device.id}`, result.device_token);
      }
      setNewName("");
      setAdding(false);
    } catch (reason) { setError(reason.message); }
  };

  const selectDevice = async (device) => {
    if (!device.online) return;
    try {
      await activateDevice(device.id);
      localStorage.setItem("atto.active-device", device.id);
      const token = localStorage.getItem(`atto.device-token:${device.id}`);
      if (token) localStorage.setItem("atto.device-token", token);
      navigate("/use");
    } catch (reason) { setError(reason.message); }
  };

  const visibleDevices = devices
    .filter((device) => device.online || showOffline)
    .sort((left, right) => Number(right.online) - Number(left.online) || left.name.localeCompare(right.name));
  const onlineCount = devices.filter(({ online }) => online).length;
  const offlineCount = devices.length - onlineCount;

  return <main className="devices-page">
    <div className="devices-heading"><div><span className="devices-brand">ATTO CONNECT</span><h1>Um espaço. Todos os seus dispositivos.</h1><p>{onlineCount ? `${onlineCount} conectado${onlineCount > 1 ? "s" : ""} agora` : "Abra o Atto em outro dispositivo para vê-lo aqui"}</p></div><div className="devices-heading-actions"><button className="devices-terminal-btn" type="button" onClick={() => navigate("/terminal")}>Terminal</button><button className="devices-refresh" type="button" onClick={refresh}>↻ Atualizar</button></div></div>
    {error && <p className="devices-error">{error}</p>}
    <section className="devices-list">
      {devices.length === 0 && !error && <p>Nenhum dispositivo registrado.</p>}
      {visibleDevices.map((device) => <article className={`device-card${device.online ? " online" : " offline"}`} key={device.id} onClick={() => selectDevice(device)} onKeyDown={(event) => event.key === "Enter" && selectDevice(device)} role={device.online ? "button" : undefined} tabIndex={device.online ? 0 : -1}>
        <div className="device-identity"><div className={`device-avatar ${device.online ? "active" : ""}`}>{(device.name || "?").slice(0, 1).toUpperCase()}</div><div><strong>{device.name}</strong><small><span className={`device-status ${device.online ? "online" : "offline"}`} />{device.online ? "Conectado agora" : "Visto anteriormente"}</small></div></div>
        <div className="device-capabilities">{(device.capabilities || []).slice(0, 3).map((capability) => <span key={capability}>{capability.replace("camera.capture", "Câmera").replace("music.play", "Áudio").replace("notification", "Alertas").replace("display", "Tela")}</span>)}</div>
        <code title="Identificador do dispositivo">ID: {device.id}</code>
        <div className="device-actions" onClick={keepEditing} onKeyDown={keepEditing}>{editing === device.id ? <><input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(device); if (event.key === "Escape") setEditing(null); }} autoFocus /><button type="button" onClick={() => save(device)}>Salvar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></> : <button className="edit-device" type="button" onClick={() => { setEditing(device.id); setName(device.name); }}>Editar nome</button>}</div>
      </article>)}
      {adding ? <article className="device-card add-device-card"><div className="device-avatar">+</div><input className="new-device-input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome do dispositivo" autoFocus /><div className="device-actions"><button type="button" onClick={addDevice}>Cadastrar</button><button type="button" onClick={() => setAdding(false)}>Cancelar</button></div></article> : <button className="add-device-card" type="button" onClick={() => setAdding(true)}><span className="add-device-plus">+</span><strong>Adicionar dispositivo</strong></button>}
    </section>
    {offlineCount > 0 && <button className="show-offline" type="button" onClick={() => setShowOffline(!showOffline)}>{showOffline ? "Ocultar" : "Mostrar"} {offlineCount} dispositivo{offlineCount > 1 ? "s" : ""} offline</button>}
  </main>;
};
