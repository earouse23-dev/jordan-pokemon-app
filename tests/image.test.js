import assert from "node:assert/strict";
import test from "node:test";
import imageHandler, {
  cardImageProxyPath,
  normalizeImageSource,
} from "../api/card-image.js";

function mockResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
  };
}

test("card image relay accepts only narrow approved HTTPS image hosts", () => {
  assert.equal(
    normalizeImageSource("https://assets.tcgdex.net/en/swsh/swsh7/215/low.webp")
      ?.hostname,
    "assets.tcgdex.net",
  );
  assert.equal(
    normalizeImageSource("https://images.pokemontcg.io/swsh7/215_hires.png")
      ?.hostname,
    "images.pokemontcg.io",
  );
  assert.equal(normalizeImageSource("http://assets.tcgdex.net/card.png"), null);
  assert.equal(normalizeImageSource("https://example.com/card.png"), null);
  assert.equal(
    normalizeImageSource("https://user:secret@assets.tcgdex.net/card.png"),
    null,
  );
  assert.equal(normalizeImageSource("file:///etc/passwd"), null);
});

test("card image proxy paths preserve an approved source without exposing it as a route", () => {
  const path = cardImageProxyPath(
    "https://assets.tcgdex.net/en/base/base1/4/high.png",
  );
  assert.match(path, /^\/api\/card-image\?url=/);
  assert.equal(
    decodeURIComponent(path.split("url=")[1]),
    ["https://assets.tcgdex.net/en/base/base1/4/high.png"].join(""),
  );
  assert.equal(cardImageProxyPath("https://example.com/card.png"), null);
});

test("card image relay returns verified image bytes with bounded shared caching", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(Uint8Array.from([137, 80, 78, 71]), {
      status: 200,
      headers: {
        "content-type": "image/png",
        "content-length": "4",
      },
    });
  try {
    const response = mockResponse();
    await imageHandler(
      {
        method: "GET",
        query: {
          url: "https://assets.tcgdex.net/en/base/base1/4/high.png",
        },
      },
      response,
    );
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-type"], "image/png");
    assert.match(response.headers["cache-control"], /s-maxage=604800/);
    assert.deepEqual([...response.body], [137, 80, 78, 71]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("card image relay rejects methods and unsupported upstream content", async () => {
  const methodResponse = mockResponse();
  await imageHandler({ method: "POST", query: {} }, methodResponse);
  assert.equal(methodResponse.statusCode, 405);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  try {
    const response = mockResponse();
    await imageHandler(
      {
        method: "GET",
        query: {
          url: "https://assets.tcgdex.net/en/base/base1/4/high.png",
        },
      },
      response,
    );
    assert.equal(response.statusCode, 415);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
