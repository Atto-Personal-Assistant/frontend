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

  const refresh = () => listDevices().then((data) => setDevices(data.devices || [])).catch((reason) => setError(reason.message));
  useEffect(() => { refresh(); }, []);

  const save = async (device) => {
    try {
      const result = await renameDevice(device.id, name.trim());
      setDevices((current) => current.map((item) => item.id === device.id ? result.device : item));
      setEditing(null);
    } catch (reason) { setError(reason.message); }
  };

  const addDevice = async () => {
    if (!newName.trim()) return;
    try {
      const result = await registerDevice({ name: newName.trim() });
      setDevices((current) => [...current, result.device]);
      setNewName("");
      setAdding(false);
    } catch (reason) { setError(reason.message); }
  };

  const selectDevice = async (device) => {
    try {
      await activateDevice(device.id);
      localStorage.setItem("atto.active-device", device.id);
      navigate("/use");
    } catch (reason) { setError(reason.message); }
  };

  return <main className="devices-page">
    <div className="devices-heading"><div><span className="devices-brand">ATTO</span><h1>Quem está usando?</h1><p>Escolha um dispositivo para continuar</p></div><button className="devices-refresh" type="button" onClick={refresh}>Atualizar</button></div>
    {error && <p className="devices-error">{error}</p>}
    <section className="devices-list">
      {devices.length === 0 && !error && <p>Nenhum dispositivo registrado.</p>}
      {devices.map((device) => <article className="device-card" key={device.id} onClick={() => selectDevice(device)} onKeyDown={(event) => event.key === "Enter" && selectDevice(device)} role="button" tabIndex={0}>
        <div className="device-identity"><div className={`device-avatar ${device.online ? "active" : ""}`}>{(device.name || "?").slice(0, 1).toUpperCase()}</div><div><strong>{device.name}</strong><small><span className={`device-status ${device.online ? "online" : "offline"}`} />{device.online ? "Disponível agora" : "Offline"}</small></div></div>
        <code title="Identificador do dispositivo">ID: {device.id}</code>
        <div className="device-actions">{editing === device.id ? <><input value={name} onChange={(event) => setName(event.target.value)} autoFocus /><button type="button" onClick={() => save(device)}>Salvar</button><button type="button" onClick={() => setEditing(null)}>Cancelar</button></> : <button className="edit-device" type="button" onClick={() => { setEditing(device.id); setName(device.name); }}>Editar nome</button>}</div>
      </article>)}
      {adding ? <article className="device-card add-device-card"><div className="device-avatar">+</div><input className="new-device-input" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome do dispositivo" autoFocus /><div className="device-actions"><button type="button" onClick={addDevice}>Cadastrar</button><button type="button" onClick={() => setAdding(false)}>Cancelar</button></div></article> : <button className="add-device-card" type="button" onClick={() => setAdding(true)}><span className="add-device-plus">+</span><strong>Adicionar dispositivo</strong></button>}
    </section>
  </main>;
};
