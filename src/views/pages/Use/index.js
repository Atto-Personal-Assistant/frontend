import { useEffect, useState } from "react";

import { Layout } from "views/components";

import "./index.css";
import { fetchInitial, startRecording, stopRecording } from "./services";

export const Use = () => {
  const [recorder, setRecorder] = useState(null);

  useEffect(() => {
    fetchInitial({
      setRecorder,
    });
  }, []);

  return (
    <Layout>
      <div className="use-response">
        <p>Gravar Pergunta</p>

        <button
          className="use-button"
          onMouseDown={() => startRecording({ recorder })}
          onMouseUp={() => stopRecording({ recorder })}
          onTouchStart={() => startRecording({ recorder })}
          onTouchEnd={() => stopRecording({ recorder })}
        />
      </div>
      <div className="use-request">
        <p>Resposta da Rede Neural</p>

        <audio className="use-audio" controls />
      </div>
    </Layout>
  );
};
