import { Link } from "react-router";

/**
 * The top bar on every page. Sign-in screens wait until after V1, so the
 * button opens the plant list, which lives in this browser.
 */
export function Nav() {
  return (
    <header className="lp-nav-wrap">
      <nav className="lp-nav" aria-label="Main">
        <Link to="/" className="lp-wordmark">
          nativo
        </Link>
        <div className="lp-nav__links">
          <Link to="/rebates" className="lp-only-desktop">
            Rebates
          </Link>
          <Link to="/blog" className="lp-only-desktop">
            Guides
          </Link>
          <Link to="/faq" className="lp-only-desktop">
            FAQ
          </Link>
          <Link to="/about" className="lp-only-desktop">
            About
          </Link>
          <Link to="/list" className="lp-button lp-button--gold lp-button--nav lp-nav__list">
            My plant list
          </Link>
        </div>
      </nav>
    </header>
  );
}
