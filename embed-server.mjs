import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/*
  PORT = public-facing embed wrapper
  API_PORT = your real ChronOS server.mjs port

  Based on what you showed:
  - your real server is already running on 3000
  - this wrapper must sit on a DIFFERENT port
*/
const PORT = 3010;
const API_PORT = 3000;

// allow iframe embedding
app.use((req, res, next) => {
  res.removeHeader("X-Frame-Options");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  res.setHeader("Content-Security-Policy", "frame-ancestors *;");
  next();
});

// proxy API calls to the real ChronOS server
app.use("/api", async (req, res) => {
  const target = `http://127.0.0.1:${API_PORT}${req.originalUrl}`;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        Accept: req.headers.accept || "*/*",
        "Content-Type": req.headers["content-type"] || "application/json"
      }
    });

    const contentType = upstream.headers.get("content-type") || "application/json";
    const body = await upstream.text();

    res.status(upstream.status);
    res.setHeader("Content-Type", contentType);
    res.send(body);
  } catch (err) {
    console.error("API proxy error:", err);
    res.status(500).json({
      error: "API proxy error",
      detail: err.message,
      target
    });
  }
});

// serve static frontend files
app.use(express.static(__dirname, { extensions: ["html"] }));

// hard route for index
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// fallback route
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Embed server running on http://127.0.0.1:${PORT}`);
  console.log(`Proxying /api/* -> http://127.0.0.1:${API_PORT}/api/*`);
});