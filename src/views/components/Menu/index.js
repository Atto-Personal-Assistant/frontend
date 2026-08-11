import { Link, useLocation } from "react-router-dom";

import { PAGES } from "application/constants";

import "./index.css";

export const Menu = () => {
  const location = useLocation();

  return (
    <ul className="menu">
      {PAGES.map(({ path, label }, index) => (
        <li key={index}>
          <Link
            className={location.pathname === path ? "activated" : ""}
            to={path}
          >
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
};
