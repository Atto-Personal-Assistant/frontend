import axios from "axios";

import { Config } from "application/constants";

export const useNeuralNetwork = ({ payload, callback, callbackError }) => {
  axios
    .post(
      `${Config.STAGE.BASE_URL}/${Config.ROUTES.NEURAL_NEWTWORK.USE}`,
      payload
    )
    .then(callback)
    .catch(callbackError);
};

export const trainNeuralNetwork = ({ payload, callback }) => {
  axios
    .post(
      `${Config.STAGE.BASE_URL}/${Config.ROUTES.NEURAL_NEWTWORK.TRAIN}`,
      payload
    )
    .then(callback)
    .catch((error) => {
      console.error("Erro ao enviar textos para o backend:", error);
    });
};
