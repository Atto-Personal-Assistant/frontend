import React from "react";
import Routes from "routes";

import { DesktopTitlebar } from "views/components/DesktopTitlebar";

import "views/styles/globalStyles.css";

const App = () => (
  <>
    <DesktopTitlebar />

    <Routes />
  </>
);

export default App;
