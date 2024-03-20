import { useLocation } from "react-router-dom";

import { PAGES } from "application/constants";

import "./index.css";

export const Menu = () => {
  const location = useLocation();

  return (
    <ul className="menu">
      {PAGES.map(({ path, label }, index) => (
        <li key={index}>
          <a
            className={location.pathname === path ? "activated" : ""}
            href={path}
          >
            {label}
          </a>
        </li>
      ))}
    </ul>
  );
};
