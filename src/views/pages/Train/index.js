import { Layout } from "views/components";

import "./index.css";
import { useTrain } from "./useTrain";

export const Train = () => {
  const { train, sendRequest, onChangeInput, isValidToSendRequest } =
    useTrain();

  console.log("train.response", train.response);
  

  return (
    <Layout>
      <div className="train-request">
        <h3>Gravar Pergunta/Resposta</h3>

        <div>
          <input
            name="input"
            value={train.input}
            onChange={onChangeInput}
            placeholder="Pergunta"
          />
          <input
            name="output"
            value={train.output}
            onChange={onChangeInput}
            placeholder="Resposta"
          />
          <button
            disabled={!isValidToSendRequest}
            onClick={sendRequest}
            className="train-button"
          >
            Enviar
          </button>
        </div>
      </div>

      <div className="train-response">
        <h3>Resposta da Rede Neural</h3>

        <p>{train.response}</p>
      </div>
    </Layout>
  );
};
