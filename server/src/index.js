"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs/promises");
const path = require("node:path");

const exec = promisify(execFile);
const app = express();
const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.API_TOKEN || "";
const DEVICE = process.env.REDROID_CONTAINER || "moo-android";
const IMAGE = process.env.REDROID_IMAGE || "redroid/redroid:12.0.0_64only-latest";
const NETWORK = process.env.DOCKER_NETWORK || "moo-net";
const WIDTH = String(Math.min(1440, Math.max(480, Number(process.env.DISPLAY_WIDTH || 720))));
const HEIGHT = String(Math.min(2560, Math.max(800, Number(process.env.DISPLAY_HEIGHT || 1280))));
const DPI = String(Math.min(480, Math.max(120, Number(process.env.DISPLAY_DPI || 320))));
const MAX_APK = 250 * 1024 * 1024;

if (TOKEN.length < 32) {
  console.error("API_TOKEN must be set to a random secret of at least 32 characters.");
  process.exit(1);
}

const origins = (process.env.ALLOWED_ORIGINS || "").split(",").map(v => v.trim()).filter(Boolean);
app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Authorization", "Content-Type"]
}));
app.use(express.json({ limit: "32kb" }));
app.use(rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: "draft-7", legacyHeaders: false }));

const upload = multer({
  dest: "/tmp/moo-uploads",
  limits: { fileSize: MAX_APK, files: 1 },
  fileFilter(req, file, callback) {
    if (path.extname(file.originalname).toLowerCase() !== ".apk") {
      return callback(new Error("Only .apk files are accepted"));
    }
    callback(null, true);
  }
});

function requireToken(req, res, next) {
  const header = req.get("authorization") || "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (supplied.length !== TOKEN.length || !require("node:crypto").timingSafeEqual(Buffer.from(supplied), Buffer.from(TOKEN))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function docker(args) {
  return exec("docker", args, { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
}

async function inspectDevice() {
  try {
    const { stdout } = await docker(["inspect", "--format", "{{.State.Status}}", DEVICE]);
    return stdout.trim();
  } catch {
    return "missing";
  }
}

async function ensureAdb() {
  await exec("adb", ["connect", DEVICE + ":5555"], { timeout: 12_000, maxBuffer: 512 * 1024 });
  const { stdout } = await exec("adb", ["-s", DEVICE + ":5555", "get-state"], { timeout: 12_000, maxBuffer: 512 * 1024 });
  if (!stdout.trim().includes("device")) throw new Error("Android device is not ready yet");
}

app.get("/api/health", (req, res) => res.json({ ok: true, service: "moo-launcher-api", version: "0.1.0" }));
app.use("/api", requireToken);

app.get("/api/device/status", async (req, res) => {
  const state = await inspectDevice();
  let adb = "unavailable";
  if (state === "running") {
    try { await ensureAdb(); adb = "connected"; } catch { adb = "starting"; }
  }
  res.json({ device: DEVICE, androidImage: IMAGE, container: state, adb, screenStreaming: "not-configured" });
});

app.post("/api/device/start", async (req, res) => {
  try {
    const state = await inspectDevice();
    if (state === "running") return res.json({ ok: true, state: "running", message: "Android is already running" });
    if (state !== "missing") {
      await docker(["start", DEVICE]);
    } else {
      await docker([
        "run", "-d", "--name", DEVICE, "--privileged", "--restart", "unless-stopped",
        "--network", NETWORK, "-v", "moo-android-data:/data",
        IMAGE,
        "androidboot.redroid_width=" + WIDTH,
        "androidboot.redroid_height=" + HEIGHT,
        "androidboot.redroid_dpi=" + DPI
      ]);
    }
    res.status(202).json({ ok: true, state: "starting", message: "Android container start requested" });
  } catch (error) {
    console.error("start failed:", error.message);
    res.status(500).json({ error: "Could not start Android. Check host kernel modules and Docker logs." });
  }
});

app.post("/api/device/stop", async (req, res) => {
  try {
    const state = await inspectDevice();
    if (state === "missing" || state === "exited") return res.json({ ok: true, state: "stopped" });
    await docker(["stop", "--time", "15", DEVICE]);
    res.json({ ok: true, state: "stopped" });
  } catch (error) {
    console.error("stop failed:", error.message);
    res.status(500).json({ error: "Could not stop Android container" });
  }
});

app.post("/api/apps/install", upload.single("apk"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an APK file" });
  try {
    if (await inspectDevice() !== "running") return res.status(409).json({ error: "Start the Android device first" });
    await ensureAdb();
    const result = await exec("adb", ["-s", DEVICE + ":5555", "install", "-r", req.file.path], {
      timeout: 180_000, maxBuffer: 2 * 1024 * 1024
    });
    res.json({ ok: true, output: result.stdout.trim() || "APK install completed" });
  } catch (error) {
    console.error("APK install failed:", error.message);
    res.status(500).json({ error: "APK installation failed. Check device readiness and APK compatibility." });
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
});

app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.message });
  if (error) return res.status(400).json({ error: error.message || "Bad request" });
  next();
});

app.listen(PORT, "0.0.0.0", () => console.log("Moo Launcher API listening on " + PORT));
