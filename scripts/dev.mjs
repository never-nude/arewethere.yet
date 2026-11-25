import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPageRenderer } from "./publish-html.mjs";
import { createApp } from "../src/runtime.mjs";

const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
const dataRoot = fileURLToPath(new URL("../dist-pages/", import.meta.url));
try { await readFile(resolve(dataRoot, "data/observatory.json")); }
catch { await import("./build-pages.mjs"); }
const port = Number(process.env.PORT ?? 4173);
const host = "127.0.0.1";
const origin = `http://${host}:${port}`;

const app = createApp({
  development: true,
  async readAsset(path) {
    try {
      const source = await readFile(resolve(path.startsWith("/data/") ? dataRoot : siteRoot, `.${path}`));
      if (!path.endsWith(".html")) return source;
      const feed = JSON.parse(await readFile(resolve(dataRoot, "data/observatory.json"), "utf8"));
      const render = await createPageRenderer(new URL("../site/", import.meta.url), feed);
      return render(path.slice(1), source.toString("utf8"));
    } catch (error) {
      if (["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code)) return null;
      throw error;
    }
  },
  async readSignals() {
    return JSON.parse(await readFile(resolve(dataRoot, "data/signals.json"), "utf8"));
  },
  async readSnapshot() {
    const { snapshot } = await import("../src/snapshot.js");
    return snapshot;
  },
});

const server = createServer(async (incoming, outgoing) => {
  try {
    const response = await app.fetch(new Request(new URL(incoming.url, origin), {
      method: incoming.method,
      headers: { accept: incoming.headers.accept || "*/*" },
    }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end("Internal server error");
  }
});

server.listen(port, host, () => {
  console.log(`Local: http://${host}:${server.address().port}`);
});
