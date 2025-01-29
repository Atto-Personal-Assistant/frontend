const STAGE = {
  local: {
    BASE_URL: "http://127.0.0.1:8000",
  },
  development: {
    BASE_URL: "https://api-b87s.onrender.com",
  },
  production: {
    BASE_URL: "https://api-b87s.onrender.com",
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
