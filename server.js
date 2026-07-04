// Zero-dependency static file server (this project has no build step / npm deps).
// Needed because ES modules + getUserMedia require http(s)/localhost, not file://.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5500;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
};

http
  .createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const filePath = path.join(ROOT, urlPath === "/" ? "/index.html" : urlPath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`Serving ${ROOT}`);
    console.log(`  PC:    http://localhost:${PORT}`);
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const addr of addrs || []) {
        if (addr.family === "IPv4" && !addr.internal) {
          console.log(`  LAN:   http://${addr.address}:${PORT}  (같은 Wi-Fi 기기용, 카메라는 https 터널 필요)`);
        }
      }
    }
  });
