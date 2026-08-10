const STAGE = {
  local: {
    BASE_URL: "http://127.0.0.1:8000",
    AGENT_TRANSPORT: "websocket",
  },
  development: {
    // The agent runs alongside the local API/Ollama process. A hosted API can
    // still be selected explicitly with REACT_APP_API_URL.
    BASE_URL: "http://127.0.0.1:8000",
    AGENT_TRANSPORT: "websocket",
  },
  production: {
    BASE_URL:
      "https://ur5lvlgls6f2zsoqgi6o3enofi0bfbrv.lambda-url.sa-east-1.on.aws",
    AGENT_TRANSPORT: "http",
  },
};

const Config = {
  ROUTES: {
    NEURAL_NEWTWORK: {
      USE: "neural-network/use",
      TRAIN: "neural-network/train",
    },
  },
  STAGE: STAGE[process.env.REACT_APP_ENV] ?? STAGE[process.env.NODE_ENV],
};

export { Config };
