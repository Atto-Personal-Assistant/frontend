import { Menu } from "views/components";
import { DesktopTitlebar } from "../DesktopTitlebar";

import "./index.css";

export const Layout = ({ children }) => {
  return (
    <div>
      <DesktopTitlebar />
      <Menu />

      <>{children}</>
    </div>
  );
};
