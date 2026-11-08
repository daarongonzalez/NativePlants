import type { ReactNode } from "react";
import { Links, Meta, Outlet, Scripts, ScrollRestoration, isRouteErrorResponse } from "react-router";
import type { Route } from "./+types/root";

// Design system stylesheets, loaded once, in order. Each is linked on its own
// so the Google Fonts @import at the top of each file stays valid.
import nativoFonts from "../../../design/nativo/fonts.css?url";
import nativoTokens from "../../../design/nativo/tokens.css?url";
import npTokens from "@np/ui/tokens.css?url";
import playful from "@np/ui/playful.css?url";
import base from "./styles/base.css?url";
// The landing page's pieces (nav, buttons, windows, notes) are used on every
// page, including the error page, so they load globally too.
import landing from "./styles/landing.css?url";
import site from "./styles/site.css?url";
import { ErrorPanel, LoadingPill, PageShell, PrintOpener } from "./components/site/SiteChrome";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: nativoFonts },
  { rel: "stylesheet", href: nativoTokens },
  { rel: "stylesheet", href: npTokens },
  { rel: "stylesheet", href: playful },
  { rel: "stylesheet", href: base },
  { rel: "stylesheet", href: landing },
  { rel: "stylesheet", href: site },
];

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <LoadingPill />
      <PrintOpener />
      <Outlet />
    </>
  );
}

export function meta() {
  return [{ title: "Something went wrong · nativo" }];
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let code = "500";
  let title = "Something went wrong on our end";
  let detail = "It's not you. Please try again in a moment. If it keeps happening, tell us what you were doing.";
  let showRetry = true;

  if (isRouteErrorResponse(error)) {
    code = String(error.status);
    if (error.status === 404) {
      title = "We couldn't find that page";
      detail = "The link may be old, or the address may have a typo. Start again from the home page, or open your plant list.";
      showRetry = false;
    } else if (error.status === 503) {
      title = "We're having trouble reaching our data";
      detail = "Our soil and climate data is taking a break. Please try again in a moment.";
    }
  } else if (import.meta.env.DEV && error instanceof Error) {
    detail = error.message;
  }

  return (
    <PageShell>
      <ErrorPanel code={code} title={title} detail={detail} showRetry={showRetry} />
    </PageShell>
  );
}
