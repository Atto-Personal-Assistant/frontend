import { Layout } from "views/components";

import { useUse } from "./useUse";
import "./index.css";

export const Use = () => {
  const { input, messages, handleInput, sendRequest } = useUse();

  return (
    <Layout>
      <div className="chat">
        <h3 className="chat-title">Chat</h3>

        {messages.map(({ actor, message }, currentIndex) => {
          const sideMessage = actor === "Atto" ? "left" : "right";

          return (
            <div id={currentIndex} className={`chat-message-${sideMessage}`}>
              {message}
            </div>
          );
        })}

        <div className="chat-request">
          <input
            value={input}
            onChange={handleInput}
            className="chat-request-input"
            placeholder="Faça sua pergunta..."
          />
          <button className="chat-request-send" onClick={sendRequest}>
            {">"}
          </button>
        </div>
      </div>
    </Layout>
  );
};
