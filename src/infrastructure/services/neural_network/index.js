import axios from "axios";

import { Config } from "application/constants";

const base_path = "neural-network";

export const useNeuralNetwork = ({ payload, callback, callbackError }) => {
  axios
    .post(`${Config.STAGE.BASE_URL}/${base_path}/use`, payload)
    .then(callback)
    .catch(callbackError);
};

export const trainNeuralNetwork = ({ payload, callback }) => {
  axios
    .post(`${Config.STAGE.BASE_URL}/${base_path}/train`, payload)
    .then(callback)
    .catch((error) => {
      console.error("Erro ao enviar textos para o backend:", error);
    });
};
