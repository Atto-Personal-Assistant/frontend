const apiUrl = process.env.REACT_APP_API_URL;

const STAGE = {
  local: {
    BASE_URL: apiUrl || "http://127.0.0.1:8000",
  },
  development: {
    // The agent runs alongside the local API/Ollama process. A hosted API can
    // still be selected explicitly with REACT_APP_API_URL.
    BASE_URL: apiUrl || "http://127.0.0.1:8000",
  },
  production: {
    BASE_URL:
      apiUrl ||
      "https://ur5lvlgls6f2zsoqgi6o3enofi0bfbrv.lambda-url.sa-east-1.on.aws",
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
