/* eslint-disable react-hooks/exhaustive-deps */
import { useState } from "react";

import { Config } from "application/constants";
import axios from "axios";

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

    const payload = { ...train };

    // setTrain({ input: null, output: null });

    axios
      .post(`${Config.STAGE.BASE_URL}/neural-network/train`, payload)
      .then(({ data: { response } }) =>
        setTrain((prev) => ({ ...prev, response }))
      )
      .catch((error) => {
        console.error("Erro ao enviar textos para o backend:", error);
      });
  };

  return {
    train,
    sendRequest,
    onChangeInput,
    isValidToSendRequest,
  };
};
