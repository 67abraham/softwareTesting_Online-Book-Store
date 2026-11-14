// Site header: brand, nav, and the logged-in user with a Log out button.
// The cart badge is added with the Cart page.
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Header() {
  const { user, ready, logout } = useAuth();

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

          {ready && user && (
            <>
              <span className="nav__user" data-testid="header-user" title={user.name}>
                <span className="nav__avatar" aria-hidden="true">
                  {user.name.charAt(0).toUpperCase()}
                </span>
                <span className="nav__name">{user.name}</span>
              </span>
              <button type="button" className="nav__link nav__link--plain" onClick={logout}>
                Log out
              </button>
            </>
          )}

          {ready && !user && (
            <>
              <NavLink to="/login" className="nav__link">
                Log in
              </NavLink>
              <NavLink to="/register" className="nav__link nav__link--button">
                Register
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
