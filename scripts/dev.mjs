import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/runtime.mjs";

const siteRoot = fileURLToPath(new URL("../site/", import.meta.url));
const port = Number(process.env.PORT ?? 4173);
const host = "127.0.0.1";
const origin = `http://${host}:${port}`;

const app = createApp({
  development: true,
  async readAsset(path) {
    try {
      return await readFile(resolve(siteRoot, `.${path}`));
    } catch (error) {
      if (["ENOENT", "EISDIR", "ENOTDIR"].includes(error.code)) return null;
      throw error;
    }
  },
  async readSignals() {
    const { getSignals } = await import("../src/signals.mjs");
    return getSignals();
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
