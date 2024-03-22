import { Layout } from "views/components";

import "./index.css";
import { useTrain } from "./useTrain";

export const Train = () => {
  const { startRecording, stopRecording, recorder } = useTrain();

  return (
    <Layout>
      <div className="train-request">
        <p>Gravar Pergunta/Resposta</p>

        <button
          className="train-button"
          onMouseDown={() => startRecording({ recorder })}
          onMouseUp={() => stopRecording({ recorder })}
          onTouchStart={() => startRecording({ recorder })}
          onTouchEnd={() => stopRecording({ recorder })}
        />
      </div>

      <div className="train-response">
        <p>Resposta da Rede Neural</p>

        <audio className="train-audio" controls />
      </div>
    </Layout>
  );
};
