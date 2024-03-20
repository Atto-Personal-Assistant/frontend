const TYPE_STAGES = {
    LOCAL: "LOCAL",
    DEV: "DEV",
  };
  
  const STAGE = {
    LOCAL: {
      BASE_URL: "http://127.0.0.1:8000",
    },
    DEV: {
      BASE_URL: "https://balance-api.onrender.com",
    },
  };
  
  const Config = {
    ROUTES: {
      AUTH: "auth",
      USERS: "users",
    },
    STAGE: STAGE[TYPE_STAGES.LOCAL],
  };
  
  export { Config };