export function Nav() {
  return (
    <header className="lp-nav-wrap">
      <nav className="lp-nav" aria-label="Main">
        <a href="/" className="lp-wordmark">
          nativo
        </a>
        <div className="lp-nav__links">
          <a href="#why-it-matters" className="lp-only-desktop">
            Why it matters
          </a>
          <a href="#native-yards" className="lp-only-desktop">
            Native yards
          </a>
          <a href="#rebates" className="lp-only-desktop">
            Rebates
          </a>
          <button type="button" className="lp-button lp-button--gold lp-button--nav">
            Sign in
          </button>
        </div>
      </nav>
    </header>
  );
}
