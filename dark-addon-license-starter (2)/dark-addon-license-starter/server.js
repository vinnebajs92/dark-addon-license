import express from "express";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.use(express.json({ limit: "20kb" }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "licenses.json");
const PRIVATE_PATH = path.join(__dirname, "private-key.pem");
const PUBLIC_PATH = path.join(__dirname, "public-key.pem");
const PORT = Number(process.env.PORT || 3000);
const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

async function loadDb() {
  try { return JSON.parse(await fs.readFile(DB_PATH, "utf8")); }
  catch { return { licenses: {} }; }
}
async function saveDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), { mode: 0o600 });
}
async function ensureKeys() {
  try {
    await fs.access(PRIVATE_PATH);
    await fs.access(PUBLIC_PATH);
  } catch {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    await fs.writeFile(PRIVATE_PATH, privateKey.export({ type: "pkcs8", format: "pem" }), { mode: 0o600 });
    await fs.writeFile(PUBLIC_PATH, publicKey.export({ type: "spki", format: "pem" }));
  }
}
function adminOnly(req, res, next) {
  if (!ADMIN_SECRET || req.get("authorization") !== `Bearer ${ADMIN_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized. Configure ADMIN_SECRET and send it as a Bearer token." });
  }
  next();
}
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const key = crypto.createPrivateKey(requirePrivateKey);
  const signature = crypto.sign(null, Buffer.from(body), key).toString("base64url");
  return `${body}.${signature}`;
}
let requirePrivateKey;
await ensureKeys();
requirePrivateKey = await fs.readFile(PRIVATE_PATH, "utf8");

app.get("/", (_req, res) => res.json({
  service: "Dark Addon License API",
  status: "development starter",
  warning: "Not production-ready; client JAR and Discord bot are not integrated."
}));

// Admin creates one-time activation keys. Protect this endpoint with ADMIN_SECRET.
app.post("/admin/licenses", adminOnly, async (req, res) => {
  const key = `DARK-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
  const db = await loadDb();
  db.licenses[key] = {
    createdAt: new Date().toISOString(),
    activated: false,
    revoked: false,
    deviceId: null
  };
  await saveDb(db);
  res.status(201).json({ licenseKey: key });
});

// First successful activation binds the key to one device ID.
app.post("/activate", async (req, res) => {
  const { licenseKey, deviceId } = req.body || {};
  if (typeof licenseKey !== "string" || typeof deviceId !== "string" ||
      licenseKey.length > 100 || deviceId.length < 8 || deviceId.length > 200) {
    return res.status(400).json({ error: "licenseKey and deviceId are required." });
  }
  const db = await loadDb();
  const license = db.licenses[licenseKey];
  if (!license || license.revoked) return res.status(403).json({ error: "Invalid or revoked license." });
  if (license.activated && license.deviceId !== deviceId) {
    return res.status(409).json({ error: "This key has already been activated on another device." });
  }
  license.activated = true;
  license.deviceId = deviceId;
  license.activatedAt ||= new Date().toISOString();
  await saveDb(db);
  const token = sign({ licenseKey, deviceId, issuedAt: Date.now() });
  res.json({ ok: true, token });
});

app.post("/verify", async (req, res) => {
  const { licenseKey, deviceId } = req.body || {};
  const db = await loadDb();
  const license = db.licenses[licenseKey];
  const valid = !!license && license.activated && !license.revoked && license.deviceId === deviceId;
  res.status(valid ? 200 : 403).json({ valid });
});

app.post("/admin/revoke", adminOnly, async (req, res) => {
  const { licenseKey } = req.body || {};
  const db = await loadDb();
  if (!db.licenses[licenseKey]) return res.status(404).json({ error: "License not found." });
  db.licenses[licenseKey].revoked = true;
  await saveDb(db);
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`Dark Addon License API listening on port ${PORT}`));
