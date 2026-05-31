#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

import { parseArgs, requireOption } from "./args.mjs";

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function parseServerOptions(argv) {
  const { options } = parseArgs(argv);
  return {
    root: resolve(requireOption(options, "root")),
    host: typeof options.host === "string" ? options.host : "127.0.0.1",
    port: Number.parseInt(typeof options.port === "string" ? options.port : "8790", 10),
  };
}

function isInsideRoot(root, filePath) {
  const relativePath = relative(root, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function resolveRequestPath(root, requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(root, `.${requestedPath}`);

  if (!isInsideRoot(root, filePath)) {
    return null;
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) {
    return null;
  }
  return filePath;
}

export function createStaticServer({ root }) {
  return createServer(async (request, response) => {
    try {
      const filePath = await resolveRequestPath(root, request.url ?? "/");
      if (filePath == null) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found\n");
        return;
      }

      response.writeHead(200, {
        "content-type": contentTypes.get(extname(filePath)) ?? "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(await readFile(filePath));
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(`Static server error: ${error.message}\n`);
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { root, host, port } = parseServerOptions(process.argv.slice(2));
  const server = createStaticServer({ root });

  const stop = () => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);

  server.on("error", (error) => {
    process.stderr.write(`Static server failed: ${error.message}\n`);
    process.exitCode = 1;
  });

  server.listen({ host, port }, () => {
    process.stdout.write(`LISTENING http://${host}:${port}/\n`);
  });
}
