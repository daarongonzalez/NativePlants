import { isbot } from "isbot";
import { renderToReadableStream } from "react-dom/server";
import type { AppLoadContext, EntryContext, HandleErrorFunction } from "react-router";
import { ServerRouter } from "react-router";
import { reportError } from "@np/shared";

/**
 * Errors thrown in loaders and actions. Aborted requests (a visitor leaving
 * mid-load) are not errors worth an alert.
 */
export const handleError: HandleErrorFunction = (error, { request, context }) => {
  if (request.signal.aborted) return;
  const cf = (context as AppLoadContext | undefined)?.cloudflare;
  reportError(cf?.env, "web loader", error, { url: request.url, ...(cf?.ctx ? { ctx: cf.ctx } : {}) });
};

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: AppLoadContext,
) {
  let shellRendered = false;
  const userAgent = request.headers.get("user-agent");

  const body = await renderToReadableStream(<ServerRouter context={routerContext} url={request.url} />, {
    onError(error: unknown) {
      responseStatusCode = 500;
      // Errors after the shell has rendered are already streamed; log the rest.
      if (shellRendered) console.error(error);
    },
  });
  shellRendered = true;

  // Bots and static generation get the whole page at once.
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  return new Response(body, { headers: responseHeaders, status: responseStatusCode });
}
