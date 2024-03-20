import React from "react";
import { BrowserRouter, Routes as Switch, Route } from "react-router-dom";

import { ROUTES } from "application/constants";

const Routes = () => (
  <BrowserRouter>
    <Switch>
      {ROUTES.map((route, index) => (
        <Route key={index} path={route.path} element={<route.component />} />
      ))}
    </Switch>
  </BrowserRouter>
);

export default Routes;
