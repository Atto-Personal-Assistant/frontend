import { useEffect, useState } from "react";

import { Layout } from "views/components";

import "./index.css";
import { fetchInitial, startRecording, stopRecording } from "./services";

export const Train = () => {
  const [recorder, setRecorder] = useState(null);

  useEffect(() => {
    fetchInitial({
      setRecorder,
    });
  }, []);

  return (
    <Layout>
      <div className="train-request">
        <p>Gravar Pergunta</p>

        <button
          className="train-button"
          onMouseDown={() => startRecording({ recorder })}
          onMouseUp={() => stopRecording({ recorder })}
          onTouchStart={() => startRecording({ recorder })}
          onTouchEnd={() => stopRecording({ recorder })}
        />
      </div>
      <div className="train-request">
        <p>Gravar Resposta</p>

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
