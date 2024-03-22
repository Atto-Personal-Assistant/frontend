/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useState } from "react";

import { MediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";

import { Config } from "application/constants";

export const useTrain = () => {
  const [recorder, setRecorder] = useState(null);
  const [train, setTrain] = useState({ input: null, output: null });

  const timeElapsed =
    (localStorage.getItem("timeEnd") ?? 0) -
    (localStorage.getItem("timeStart") ?? 0);

  const onRecordingReady = ({ data: recordBlob }) => {
    setTrain((prev) => ({
      input: prev?.input ?? recordBlob,
      output: !!prev?.input ? recordBlob : prev.output,
    }));
  };

  const fetchInitial = async ({ setRecorder }) => {
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

  const startRecording = ({ recorder }) => {
    const dateNow = new Date().getTime();
    localStorage.setItem("timeStart", dateNow);
    navigator.vibrate(200);
    recorder.start();
  };

  const stopRecording = ({ recorder }) => {
    const dateNow = new Date().getTime();
    localStorage.setItem("timeEnd", dateNow);
    recorder.stop();
  };

  const sendRecord = () => {
    const formData = new FormData();

    formData.append("input_audio", train.input);
    formData.append("output_audio", train.output);

    setTrain({ input: null, output: null });

    fetch(`${Config.STAGE.BASE_URL}/neural-network/train`, {
      method: "POST",
      body: formData,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Erro ao enviar áudio para o backend");
        }
        return response.json();
      })
      .then((response) => console.log("response", response))
      .catch((error) => {
        console.error("Erro ao enviar áudio para o backend:", error);
      });
  };

  useEffect(() => {
    fetchInitial({
      setRecorder,
    });
  }, []);

  useEffect(() => {
    if (timeElapsed >= 1000 && !!train?.input && !!train?.output) {
      sendRecord();
    }
  }, [train]);

  return {
    fetchInitial,
    startRecording,
    stopRecording,
    recorder,
    setRecorder,
  };
};
