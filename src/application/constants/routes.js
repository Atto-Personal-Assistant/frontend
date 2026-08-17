import { Home, Use, Devices, Terminal } from "views/pages";

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
  {
    path: "/terminal",
    component: Terminal,
  },
];
