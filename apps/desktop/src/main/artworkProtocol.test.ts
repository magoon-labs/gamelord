import { describe, it, expect, vi } from "vitest";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createArtworkProtocolHandler } from "./artworkProtocol";

const ARTWORK_DIR = "/Users/test/Library/Application Support/gamelord/artwork";

function setup() {
  const fetchFile = vi.fn(
    async () => new Response("image-bytes", { headers: { "Content-Type": "image/png" } }),
  );
  const handler = createArtworkProtocolHandler(ARTWORK_DIR, fetchFile);
  return { fetchFile, handler };
}

describe("createArtworkProtocolHandler", () => {
  it("serves a file from the artwork directory with a CORP header", async () => {
    const { fetchFile, handler } = setup();

    const response = await handler(new Request("artwork://abc.png"));

    expect(fetchFile).toHaveBeenCalledWith(
      pathToFileURL(path.join(ARTWORK_DIR, "abc.png")).toString(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");
    expect(await response.text()).toBe("image-bytes");
  });

  it.each([
    ["plain traversal", "artwork://../library.json"],
    ["encoded traversal", "artwork://%2e%2e/%2e%2e/%2e%2e/.ssh/id_ed25519"],
    ["encoded absolute path", "artwork://%2Fetc%2Fpasswd"],
    ["the artwork directory itself", "artwork://"],
  ])("returns 404 without touching the filesystem for %s", async (_label, url) => {
    const { fetchFile, handler } = setup();

    const response = await handler(new Request(url));

    expect(response.status).toBe(404);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it("encodes the resolved path so it is not decoded a second time by file://", async () => {
    const { fetchFile, handler } = setup();

    // "%2525" decodes once to the literal filename "%25.png". A naive
    // `file://${path}` would decode it again into "%.png".
    await handler(new Request("artwork://%2525.png"));

    expect(fetchFile).toHaveBeenCalledWith(
      pathToFileURL(path.join(ARTWORK_DIR, "%25.png")).toString(),
    );
  });

  it("passes through a missing-file status from the fetch", async () => {
    const fetchFile = vi.fn(async () => new Response(null, { status: 404 }));
    const handler = createArtworkProtocolHandler(ARTWORK_DIR, fetchFile);

    const response = await handler(new Request("artwork://missing.png"));

    expect(response.status).toBe(404);
  });
});
