// Site header. Login state, cart badge and logout are added with the Login page.
import { Link, NavLink } from 'react-router-dom';

export default function Header() {
  return (
    <header className="header">
      <div className="header__inner">
        <Link to="/" className="brand">
          <span className="brand__mark" aria-hidden="true">B</span>
          Online Book Store
        </Link>
        <nav className="nav" aria-label="Main">
          <NavLink to="/" end className="nav__link">
            Browse books
          </NavLink>
          <NavLink to="/login" className="nav__link">
            Log in
          </NavLink>
          <NavLink to="/register" className="nav__link nav__link--button">
            Register
          </NavLink>
        </nav>
      </div>
    </header>
  );
}
