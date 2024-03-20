import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";

import { Config } from "application/constants";

const timeElapsed =
  (localStorage.getItem("timeEnd") ?? 0) -
  (localStorage.getItem("timeStart") ?? 0);

const onRecordingReady = (event) => {
  if (timeElapsed >= 1000) {
    sendRecord(event.data);
  }
};

export const fetchInitial = async ({ setRecorder }) => {
  await register(await connect());
  await navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const response = new MediaRecorder(stream, {
      mimeType: "audio/wav",
    });
    response.addEventListener("dataavailable", onRecordingReady);
    setRecorder(response);
  });
};

export const startRecording = ({ recorder }) => {
  const dateNow = new Date().getTime();
  localStorage.setItem("timeStart", dateNow);
  navigator.vibrate(200);
  recorder.start();
};

export const stopRecording = ({ recorder }) => {
  const dateNow = new Date().getTime();
  localStorage.setItem("timeEnd", dateNow);
  recorder.stop();
};

const loadAudioFile = async (filePath) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/${filePath}`);
  const blob = await response.blob();

  const audioElement = document.getElementById("use-audio");

  audioElement.src = URL.createObjectURL(blob);
};

export const sendRecord = (blob) => {
  const formData = new FormData();
  formData.append("audio", blob);

  fetch(`${Config.STAGE.BASE_URL}/neural-network/use`, {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Erro ao enviar áudio para o backend");
      }
      return response.json();
    })
    .then((data) => loadAudioFile(data.file_path))
    .catch((error) => {
      console.error("Erro ao enviar áudio para o backend:", error);
    });
};
