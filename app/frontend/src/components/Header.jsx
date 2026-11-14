// Site header: brand, nav, cart badge, and the logged-in user with a Log out button.
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth';
import { useCart } from '../cart';

export default function Header() {
  const { user, ready, logout } = useAuth();
  const { count } = useCart();

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
              <NavLink to="/orders" className="nav__link">
                My orders
              </NavLink>
              <NavLink to="/cart" className="nav__link nav__cart" aria-label={`Cart, ${count} item(s)`}>
                Cart
                <span className="cart-badge" data-testid="cart-badge" aria-hidden="true">
                  {count}
                </span>
              </NavLink>
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
