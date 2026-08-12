import { Home, Use, Devices } from "views/pages";

export const ROUTES = [
  {
    path: "/",
    component: Devices,
  },
  {
    path: "/home",
    component: Home,
  },
  {
    path: "/use",
    component: Use,
  },
  {
    path: "/devices",
    component: Devices,
  },
];
