// Wraps pages that need a logged-in user (Cart, Checkout, Orders).
// Guests are sent to Login with "Please log in to continue." and are
// brought back to this page after logging in.
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';

export const MSG_LOGIN_REQUIRED = 'Please log in to continue.';

export default function ProtectedRoute({ children }) {
  const { user, ready, signOut } = useAuth();
  const location = useLocation();
  const here = location.pathname + location.search;

  // Still checking a saved token: render nothing for a moment instead of
  // wrongly sending a logged-in user to the Login page.
  if (!ready) return null;

  if (!user) {
    const justSignedOutHere = signOut && signOut.at === here;

    // The user clicked "Log out" on this page: logout() is already taking them home.
    if (justSignedOutHere && signOut.reason === 'logout') return null;

    // Session expired on this page: the toast already explains why, so no extra notice.
    if (justSignedOutHere && signOut.reason === 'expired') {
      return <Navigate to="/login" replace state={{ from: here }} />;
    }

    // A guest opened a login-only page.
    return <Navigate to="/login" replace state={{ message: MSG_LOGIN_REQUIRED, from: here }} />;
  }

  return children;
}
