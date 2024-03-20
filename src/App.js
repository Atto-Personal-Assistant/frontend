import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import { useEffect, useState } from "react";

import "./App.css";

const App = () => {
  const [recorder, setRecorder] = useState(null);

  console.log("render");

  const timeElapsed =
    (localStorage.getItem("timeEnd") ?? 0) -
    (localStorage.getItem("timeStart") ?? 0);

  const onRecordingReady = (event) => {
    console.log("timeElapsed", timeElapsed);
    if (timeElapsed >= 1000) {
      console.log("b");
      sendRecord(event.data);
    }
  };

  const fetchInitial = async () => {
    await register(await connect());
    await navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const response = new MediaRecorder(stream, {
          mimeType: "audio/wav",
        });
        response.addEventListener("dataavailable", onRecordingReady);
        setRecorder(response);
      });
  };

  useEffect(() => {
    fetchInitial();
  }, []);

  const startRecording = () => {
    const dateNow = new Date().getTime();
    localStorage.setItem("timeStart", dateNow);
    navigator.vibrate(200);
    recorder.start();
  };

  function stopRecording() {
    const dateNow = new Date().getTime();
    localStorage.setItem("timeEnd", dateNow);
    recorder.stop();
  }

  const sendRecord = (blob) => {
    const formData = new FormData();
    formData.append("audio", blob);

    const baseUrl = "http://127.0.0.1:8000";
    fetch(`${baseUrl}/neural-network/use`, {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Erro ao enviar áudio para o backend");
        }
        return response.json();
      })
      .then((data) => {
        console.log("Áudio enviado com sucesso:", data);
      })
      .catch((error) => {
        console.error("Erro ao enviar áudio para o backend:", error);
      });
  };

  return (
    <div className="App">
      <div className="header">Audio Recorder</div>

      <div id="records"></div>

      <div className="btns">
        <button
          id="start"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
        ></button>
      </div>
    </div>
  );
};

export default App;
