import { Link } from "react-router";
import { SITE_LINKS } from "../../content/site";

/**
 * The footer links, shared by the landing page, the flow and the content
 * pages. `tone` matches the ground it sits on.
 */
export function FooterLinks({ className = "" }: { className?: string }) {
  return (
    <nav className={`site-footer__links ${className}`} aria-label="Footer">
      {SITE_LINKS.map((l) => (
        <Link key={l.href} to={l.href}>
          {l.label}
        </Link>
      ))}
    </nav>
  );
}

/** The footer on cream pages: wordmark, the advice line and the links. */
export function SiteFooter({ note }: { note?: string }) {
  return (
    <footer className="lp-wrap site-footer no-print">
      <span className="lp-wordmark lp-wordmark--footer">nativo</span>
      <span className="site-footer__note">
        {note ?? "Advice, not a guarantee. Check toxicity warnings near pets or children."}
      </span>
      <FooterLinks />
    </footer>
  );
}
