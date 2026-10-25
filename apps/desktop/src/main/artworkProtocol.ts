import { pathToFileURL } from "node:url";
import { resolvePathWithinDir } from "./utils/pathValidation";

const ARTWORK_SCHEME_PREFIX = "artwork://";

/**
 * Build the `artwork://` protocol handler that serves cached cover art to the
 * sandboxed renderer via <img src="artwork://gameId.png">.
 *
 * Requests that resolve outside `artworkDir` (e.g. `../` or `%2e%2e/`) get a
 * 404 without touching the filesystem. The CORP header is required because
 * COEP require-corp is enabled for the renderer.
 *
 * `fetchFile` is Electron's `net.fetch` in production; it is injected so the
 * handler can be tested without Electron.
 */
export function createArtworkProtocolHandler(
  artworkDir: string,
  fetchFile: (url: string) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const filePath = resolvePathWithinDir(
      artworkDir,
      request.url.slice(ARTWORK_SCHEME_PREFIX.length),
    );
    if (!filePath) {
      return new Response(null, { status: 404 });
    }

    // pathToFileURL re-encodes the already-decoded path so file:// can't
    // decode it a second time.
    const response = await fetchFile(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Resource-Policy", "same-origin");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}
