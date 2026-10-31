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

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  { rel: "stylesheet", href: nativoFonts },
  { rel: "stylesheet", href: nativoTokens },
  { rel: "stylesheet", href: npTokens },
  { rel: "stylesheet", href: playful },
  { rel: "stylesheet", href: base },
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
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let detail = "Please try again in a moment.";
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "We couldn't find that page" : `Error ${error.status}`;
    detail = error.statusText || detail;
  }
  return (
    <main className="error-page">
      <h1>{title}</h1>
      <p>{detail}</p>
      <a href="/">Back to the start</a>
    </main>
  );
}
