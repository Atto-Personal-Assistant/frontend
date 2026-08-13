import { Link, useLocation } from "react-router-dom";

import { PAGES } from "application/constants";

import "./index.css";

export const Menu = () => {
  const location = useLocation();

  return (
    <nav className="menu" aria-label="Navegação principal">
      <Link className="menu-brand" to="/use" aria-label="Abrir Atto"><span>A</span>ATTO</Link>
      <ul>
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
      <Link className="menu-command" to="/use">Novo pedido <span>⌘ K</span></Link>
    </nav>
  );
};
