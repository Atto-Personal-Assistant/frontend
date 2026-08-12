import { Menu } from "views/components";

import "./index.css";

export const Layout = ({ children }) => {
  return (
    <div>
      <Menu />

      <>{children}</>
    </div>
  );
};
