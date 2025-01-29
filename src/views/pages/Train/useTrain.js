/* eslint-disable react-hooks/exhaustive-deps */
import { useState } from "react";

import { trainNeuralNetwork } from "infrastructure/services";

export const useTrain = () => {
  const [train, setTrain] = useState({ input: "", output: "", response: "" });

  const isValidToSendRequest =
    ![null, "", 0].includes(train.input) &&
    ![null, "", 0].includes(train.output);

  const onChangeInput = ({ target: { name, value } }) => {
    console.log(name, value);

    setTrain({ ...train, [name]: value });
  };

  const sendRequest = () => {
    if (!isValidToSendRequest) return;

    // setTrain({ input: null, output: null });

    const payload = { input: train.input, output: train.output };

    const callback = ({ data: { response } }) => {
      setTrain((prev) => ({ ...prev, response }));
    };

    trainNeuralNetwork({ payload, callback });
  };

  return {
    train,
    sendRequest,
    onChangeInput,
    isValidToSendRequest,
  };
};
