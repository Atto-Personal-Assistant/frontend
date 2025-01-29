/* eslint-disable react-hooks/rules-of-hooks */
import { useState } from "react";

import { useNeuralNetwork } from "infrastructure/services";

export const useUse = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      actor: "Atto",
      message: "Como eu posso te ajudar?",
    },
  ]);

  const isValidToSendRequest = !!input;

  const handleInput = ({ target: { value } }) => {
    setInput(value);
  };

  const sendRequest = () => {
    if (!isValidToSendRequest) return;

    setMessages((prev) => [
      ...prev,
      {
        actor: "user",
        message: input,
      },
    ]);

    // setTrain({ input: null, output: null });

    const payload = { input };

    const callback = ({ data: { response } }) => {
      setMessages((prev) => [
        ...prev,
        {
          actor: "Atto",
          message: response,
        },
      ]);
    };

    const callbackError = ({ data }) => {
      console.log("detail", data);

      setMessages((prev) => [
        ...prev,
        {
          actor: "Atto",
          message: "Houve uma falha no sistema",
        },
      ]);
    };

    useNeuralNetwork({ payload, callback, callbackError });
  };

  return {
    input,
    messages,
    handleInput,
    sendRequest,
  };
};
