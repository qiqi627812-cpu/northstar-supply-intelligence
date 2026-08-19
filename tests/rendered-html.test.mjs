import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } }, { waitUntil() {}, passThroughOnException() {} });
}

test("renders the decision-grade Northstar dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Northstar/);
  assert.match(html, /Supply chain command center/);
  assert.match(html, /Management brief/);
  assert.match(html, /Service · Cost · Cash/);
  assert.match(html, /Perfect order rate/);
  assert.match(html, /Priority exceptions/);
  assert.match(html, /Metric catalog/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});
