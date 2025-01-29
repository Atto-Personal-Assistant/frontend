import axios from "axios";

import { Config } from "application/constants";

const loadConversation = async (filePath) => {
  const response = await fetch(`${Config.STAGE.BASE_URL}/${filePath}`);
  const blob = await response.blob();

  const audioElement = document.getElementById("use-audio");

  audioElement.src = URL.createObjectURL(blob);
};

const sendRequest = () => {
  // if (!isValidToSendRequest) return;

  const payload = { input: "" };

  // setTrain({ input: null, output: null });

  axios
    .post(`${Config.STAGE.BASE_URL}/neural-network/use`, payload)
    .then(({ data: { response } }) => {})
    .catch((error) => {
      console.error("Erro ao enviar textos para o backend:", error);
    });
};
