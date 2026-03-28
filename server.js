const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { spawn } = require("child_process");

let ffmpegBinaryPath = null;
try {
  ffmpegBinaryPath = require("ffmpeg-static");
} catch {
  ffmpegBinaryPath = null;
}

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const OWNER_ADMIN_EMAIL = String(
  process.env.OWNER_ADMIN_EMAIL || "brightobengfianko@gmail.com"
)
  .trim()
  .toLowerCase();
const AUTH_TOKEN_SECRET = String(
  process.env.AUTH_TOKEN_SECRET || "hni-chat-secret-bright-obeng-fianko"
);

const APP_STORAGE_DIR = process.env.APP_STORAGE_DIR
  ? path.resolve(process.env.APP_STORAGE_DIR)
  : __dirname;
const STATIC_BASE_PATH = "/bright";
const MAINPAGE_ENTRY_PATH = `${STATIC_BASE_PATH}/mainpage/mainpage.html`;

const dataDir = path.join(APP_STORAGE_DIR, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const mediaRootDir = path.join(APP_STORAGE_DIR, "media");
const mediaUploadDir = path.join(mediaRootDir, "uploads");
const mediaConvertedDir = path.join(mediaRootDir, "converted");
if (!fs.existsSync(mediaUploadDir)) {
  fs.mkdirSync(mediaUploadDir, { recursive: true });
}
if (!fs.existsSync(mediaConvertedDir)) {
  fs.mkdirSync(mediaConvertedDir, { recursive: true });
}

const dbPath = path.join(dataDir, "auth.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS login_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      logged_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_user_id INTEGER NOT NULL,
      recipient_user_id INTEGER,
      chat_scope TEXT NOT NULL DEFAULT 'direct',
      message_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_user_id) REFERENCES users(id),
      FOREIGN KEY (recipient_user_id) REFERENCES users(id)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_scope_created ON chat_messages (chat_scope, created_at DESC, id DESC)"
  );
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_direct_pair ON chat_messages (sender_user_id, recipient_user_id, created_at DESC, id DESC)"
  );

  db.run("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0", (alterErr) => {
    if (!alterErr) {
      console.log("Schema update applied: users.is_admin");
      return;
    }

    const errorMessage = String(alterErr.message || "").toLowerCase();
    if (!errorMessage.includes("duplicate column name")) {
      console.error("Failed to add users.is_admin column:", alterErr.message);
    }
  });
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

function toBase64Url(value) {
  return Buffer.from(String(value || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, "base64").toString("utf8");
}

function createAuthToken(user) {
  const payload = {
    id: Number(user?.id) || 0,
    email: String(user?.email || "").trim().toLowerCase(),
    issued_at: new Date().toISOString(),
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", AUTH_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${encodedPayload}.${signature}`;
}

function readAuthTokenFromRequest(req) {
  const authorization = String(req.headers?.authorization || "").trim();
  if (/^bearer\s+/i.test(authorization)) {
    return authorization.replace(/^bearer\s+/i, "").trim();
  }
  return String(req.headers?.["x-hni-auth-token"] || "").trim();
}

function verifyAuthToken(token) {
  const rawToken = String(token || "").trim();
  if (!rawToken || !rawToken.includes(".")) {
    return null;
  }

  const [encodedPayload, signature = ""] = rawToken.split(".");
  const expectedSignature = crypto
    .createHmac("sha256", AUTH_TOKEN_SECRET)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload));
    const userId = Number(payload?.id) || 0;
    const email = String(payload?.email || "").trim().toLowerCase();
    if (!userId || !email) {
      return null;
    }
    return { id: userId, email };
  } catch {
    return null;
  }
}

async function requireAuthenticatedUser(req, res) {
  const token = readAuthTokenFromRequest(req);
  const session = verifyAuthToken(token);
  if (!session) {
    res.status(401).json({ ok: false, message: "Login required." });
    return null;
  }

  const user = await get("SELECT id, fullname, email, is_admin FROM users WHERE id = ?", [session.id]);
  if (!user || String(user.email || "").trim().toLowerCase() !== session.email) {
    res.status(401).json({ ok: false, message: "Login session is invalid." });
    return null;
  }

  return {
    id: user.id,
    fullname: user.fullname,
    email: user.email,
    is_admin: Number(user.is_admin) === 1,
    auth_token: token,
  };
}

function isOwnerAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === OWNER_ADMIN_EMAIL;
}

async function promoteOwnerAdminIfNeeded(user) {
  if (!user || !isOwnerAdminEmail(user.email) || Number(user.is_admin) === 1) {
    return user;
  }

  await run("UPDATE users SET is_admin = 1 WHERE id = ?", [user.id]);
  return { ...user, is_admin: 1 };
}

async function ensureConfiguredOwnerAdmin() {
  if (!OWNER_ADMIN_EMAIL) {
    return;
  }

  try {
    const owner = await get("SELECT id, email, is_admin FROM users WHERE lower(email) = lower(?)", [
      OWNER_ADMIN_EMAIL,
    ]);

    if (!owner) {
      console.log(
        `Owner admin email configured (${OWNER_ADMIN_EMAIL}). Account will become admin automatically after signup.`
      );
      return;
    }

    if (Number(owner.is_admin) !== 1) {
      await run("UPDATE users SET is_admin = 1 WHERE id = ?", [owner.id]);
      console.log(`Owner admin promoted: ${OWNER_ADMIN_EMAIL}`);
    }
  } catch (error) {
    console.error("Failed to ensure configured owner admin:", error.message);
  }
}

function toAdminFlag(value) {
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }

  if (typeof value === "number" && (value === 0 || value === 1)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "admin"].includes(normalized)) {
      return 1;
    }
    if (["0", "false", "no", "user"].includes(normalized)) {
      return 0;
    }
  }

  return null;
}

function isValidEmailAddress(value) {
  return /^[^ ]+@[^ ]+\.[a-z]{2,}$/i.test(String(value || "").trim());
}

function parsePositiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeChatScope(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "all" || normalized === "direct") {
    return normalized;
  }
  return null;
}

function normalizeChatContent(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function escapeSqlLike(value) {
  return String(value || "").replace(/[\\%_]/g, "\\$&");
}

function mapChatMessageRow(row) {
  if (!row || typeof row !== "object") {
    return null;
  }

  return {
    id: row.id,
    scope: row.chat_scope === "all" ? "all" : "direct",
    sender: {
      id: row.sender_user_id,
      fullname: row.sender_name || row.sender_email || "Member",
      email: row.sender_email || "",
    },
    recipient_user_id: row.recipient_user_id,
    content: row.message_text,
    created_at: row.created_at,
  };
}

function slugifyFilename(value) {
  const normalized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "media";
}

function isPathInsideDirectory(candidatePath, parentDir) {
  const resolvedCandidate = path.resolve(candidatePath);
  const resolvedParent = path.resolve(parentDir);
  return (
    resolvedCandidate === resolvedParent ||
    resolvedCandidate.startsWith(`${resolvedParent}${path.sep}`)
  );
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegBinaryPath) {
      reject(new Error("FFmpeg binary not available."));
      return;
    }

    const ffmpegProcess = spawn(ffmpegBinaryPath, args, { windowsHide: true });
    let stderr = "";

    ffmpegProcess.stderr.on("data", (chunk) => {
      stderr += String(chunk || "");
    });

    ffmpegProcess.on("error", (error) => {
      reject(error);
    });

    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `FFmpeg exited with code ${code}.`));
    });
  });
}

function isLikelyAudioExtension(extension) {
  const audioExtensions = new Set([
    ".mp3",
    ".wav",
    ".aac",
    ".m4a",
    ".ogg",
    ".opus",
    ".flac",
    ".wma",
  ]);
  return audioExtensions.has(String(extension || "").toLowerCase());
}

app.use(cors());
app.use(express.json());
app.use("/media", express.static(mediaRootDir));
app.use(STATIC_BASE_PATH, express.static(__dirname));

app.get("/", (req, res) => {
  res.redirect(MAINPAGE_ENTRY_PATH);
});

app.get(STATIC_BASE_PATH, (req, res) => {
  res.redirect(MAINPAGE_ENTRY_PATH);
});

app.get(`${STATIC_BASE_PATH}/`, (req, res) => {
  res.redirect(MAINPAGE_ENTRY_PATH);
});

const uploadStorage = multer.diskStorage({
  destination(req, file, callback) {
    callback(null, mediaUploadDir);
  },
  filename(req, file, callback) {
    const originalExt = path.extname(String(file?.originalname || "")).toLowerCase();
    const safeExt = originalExt && originalExt.length <= 12 ? originalExt : "";
    const randomId = Math.random().toString(16).slice(2, 10);
    callback(null, `media-${Date.now()}-${randomId}${safeExt}`);
  },
});

const mediaUpload = multer({
  storage: uploadStorage,
  limits: {
    fileSize: 350 * 1024 * 1024,
  },
  fileFilter(req, file, callback) {
    const mimeType = String(file?.mimetype || "").toLowerCase();
    const accepted = mimeType.startsWith("video/") || mimeType.startsWith("audio/");
    if (!accepted) {
      callback(new Error("Only video or audio files are allowed."));
      return;
    }
    callback(null, true);
  },
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "Auth API is running." });
});

app.post("/api/media/upload", (req, res) => {
  mediaUpload.single("media")(req, res, (error) => {
    if (error) {
      const isSizeError = String(error?.code || "").toUpperCase() === "LIMIT_FILE_SIZE";
      res.status(400).json({
        ok: false,
        message: isSizeError ? "File is too large. Max size is 350MB." : error.message || "Upload failed.",
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({ ok: false, message: "Choose a media file to upload." });
      return;
    }

    const encodedName = encodeURIComponent(req.file.filename);
    const relativeUrl = `/media/uploads/${encodedName}`;
    const absoluteUrl = `${req.protocol}://${req.get("host")}${relativeUrl}`;
    const mimeType = String(req.file.mimetype || "").toLowerCase();

    res.status(201).json({
      ok: true,
      message: "Media uploaded.",
      media: {
        url: absoluteUrl,
        relative_url: relativeUrl,
        filename: req.file.filename,
        original_name: req.file.originalname,
        mime_type: mimeType,
        media_type: mimeType.startsWith("audio/") ? "audio" : "video",
        size: req.file.size,
      },
    });
  });
});

app.get("/api/media/download", async (req, res) => {
  const requestedFormat = String(req.query?.format || "").trim().toLowerCase();
  const sourceUrl = String(req.query?.url || "").trim();
  const requestedTitle = String(req.query?.title || "").trim();
  const safeTitle = slugifyFilename(requestedTitle || "media");

  if (!["mp3", "mp4"].includes(requestedFormat)) {
    res.status(400).json({ ok: false, message: "format must be mp3 or mp4." });
    return;
  }

  if (!sourceUrl) {
    res.status(400).json({ ok: false, message: "Media URL is required." });
    return;
  }

  let parsedSourceUrl;
  try {
    const fallbackBase = `${req.protocol}://${req.get("host")}`;
    parsedSourceUrl = new URL(sourceUrl, fallbackBase);
  } catch {
    res.status(400).json({ ok: false, message: "Invalid media URL." });
    return;
  }

  let decodedPathname = "";
  try {
    decodedPathname = decodeURIComponent(parsedSourceUrl.pathname || "");
  } catch {
    res.status(400).json({ ok: false, message: "Invalid media URL encoding." });
    return;
  }
  if (!decodedPathname.startsWith("/media/uploads/")) {
    res.status(400).json({ ok: false, message: "Only uploaded media can be downloaded." });
    return;
  }

  const sourceFileName = path.basename(decodedPathname);
  const sourcePath = path.resolve(mediaUploadDir, sourceFileName);
  if (!isPathInsideDirectory(sourcePath, mediaUploadDir)) {
    res.status(400).json({ ok: false, message: "Invalid media file path." });
    return;
  }

  try {
    await fs.promises.access(sourcePath, fs.constants.R_OK);
  } catch {
    res.status(404).json({ ok: false, message: "Media file not found." });
    return;
  }

  const sourceExtension = path.extname(sourceFileName).toLowerCase();
  const alreadyRequestedFormat =
    (requestedFormat === "mp3" && sourceExtension === ".mp3") ||
    (requestedFormat === "mp4" && sourceExtension === ".mp4");

  if (alreadyRequestedFormat) {
    res.download(sourcePath, `${safeTitle}.${requestedFormat}`);
    return;
  }

  if (!ffmpegBinaryPath) {
    res.status(503).json({
      ok: false,
      message: "FFmpeg is not available on the server, so conversion cannot run.",
    });
    return;
  }

  const outputName = `${safeTitle}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.${requestedFormat}`;
  const outputPath = path.join(mediaConvertedDir, outputName);
  const convertingToMp3 = requestedFormat === "mp3";
  const isAudioOnlySource = isLikelyAudioExtension(sourceExtension);

  const ffmpegArgs = convertingToMp3
    ? ["-i", sourcePath, "-vn", "-c:a", "libmp3lame", "-q:a", "2", "-y", outputPath]
    : isAudioOnlySource
      ? ["-i", sourcePath, "-vn", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-y", outputPath]
      : ["-i", sourcePath, "-c:v", "libx264", "-c:a", "aac", "-movflags", "+faststart", "-y", outputPath];

  try {
    await runFfmpeg(ffmpegArgs);
    res.download(outputPath, `${safeTitle}.${requestedFormat}`, () => {
      fs.promises.unlink(outputPath).catch(() => {});
    });
  } catch (error) {
    fs.promises.unlink(outputPath).catch(() => {});
    res.status(500).json({
      ok: false,
      message: "Unable to convert media for download.",
      error: String(error?.message || ""),
    });
  }
});

app.get("/api/chat/session-user", async (req, res) => {
  try {
    const user = await requireAuthenticatedUser(req, res);
    if (!user) {
      return;
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        is_admin: Number(user.is_admin) === 1,
        auth_token: user.auth_token,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while resolving chat user." });
  }
});

app.post("/api/chat/session-user/ensure", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const fallbackName = String(req.body?.fullname || req.body?.username || "").trim();

  if (!email) {
    res.status(400).json({ ok: false, message: "Email is required." });
    return;
  }

  if (!isValidEmailAddress(email)) {
    res.status(400).json({ ok: false, message: "Enter a valid email address." });
    return;
  }

  const derivedName = fallbackName || email.split("@")[0] || "Member";

  try {
    let user = await get("SELECT id, fullname, email, is_admin FROM users WHERE lower(email) = lower(?)", [email]);
    if (!user) {
      const seedPassword = `chat-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const passwordHash = await bcrypt.hash(seedPassword, 10);
      const inserted = await run(
        "INSERT INTO users (fullname, email, password_hash) VALUES (?, ?, ?)",
        [derivedName, email, passwordHash]
      );
      user = await get("SELECT id, fullname, email, is_admin FROM users WHERE id = ?", [inserted.lastID]);
    }

    res.status(201).json({
      ok: true,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        is_admin: Number(user.is_admin) === 1,
      },
    });
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    if (message.includes("unique constraint failed") && message.includes("users.email")) {
      try {
        const existing = await get("SELECT id, fullname, email, is_admin FROM users WHERE lower(email) = lower(?)", [email]);
        if (existing) {
          res.status(200).json({
            ok: true,
            user: {
              id: existing.id,
              fullname: existing.fullname,
              email: existing.email,
              is_admin: Number(existing.is_admin) === 1,
            },
          });
          return;
        }
      } catch {
        // Fall through to generic server error.
      }
    }

    res.status(500).json({ ok: false, message: "Server error while ensuring chat user." });
  }
});

app.get("/api/chat/users", async (req, res) => {
  const query = String(req.query?.q || "").trim().toLowerCase();
  const requestedLimit = parsePositiveInteger(req.query?.limit);

  try {
    const currentUser = await requireAuthenticatedUser(req, res);
    if (!currentUser) {
      return;
    }
    const currentUserId = Number(currentUser.id);

    const hasQuery = Boolean(query);
    const maxLimit = 1000;
    const defaultLimit = 1000;
    const limit = Math.min(Math.max(requestedLimit || defaultLimit, 1), maxLimit);
    const safeQueryPattern = `%${escapeSqlLike(query)}%`;

    const directSummarySelect = `
            (
              SELECT dm.message_text
              FROM chat_messages dm
              WHERE dm.chat_scope = 'direct'
                AND (
                  (dm.sender_user_id = ? AND dm.recipient_user_id = u.id)
                  OR
                  (dm.sender_user_id = u.id AND dm.recipient_user_id = ?)
                )
              ORDER BY dm.created_at DESC, dm.id DESC
              LIMIT 1
            ) AS last_message_text,
            (
              SELECT dm.created_at
              FROM chat_messages dm
              WHERE dm.chat_scope = 'direct'
                AND (
                  (dm.sender_user_id = ? AND dm.recipient_user_id = u.id)
                  OR
                  (dm.sender_user_id = u.id AND dm.recipient_user_id = ?)
                )
              ORDER BY dm.created_at DESC, dm.id DESC
              LIMIT 1
            ) AS last_message_at,
            (
              SELECT dm.sender_user_id
              FROM chat_messages dm
              WHERE dm.chat_scope = 'direct'
                AND (
                  (dm.sender_user_id = ? AND dm.recipient_user_id = u.id)
                  OR
                  (dm.sender_user_id = u.id AND dm.recipient_user_id = ?)
                )
              ORDER BY dm.created_at DESC, dm.id DESC
              LIMIT 1
            ) AS last_message_sender_user_id,
            (
              SELECT COUNT(*)
              FROM chat_messages dm
              WHERE dm.chat_scope = 'direct'
                AND dm.sender_user_id = u.id
                AND dm.recipient_user_id = ?
            ) AS incoming_message_count
    `;

    const users = hasQuery
      ? await all(
          `
          SELECT
            u.id,
            u.fullname,
            u.email,
            u.is_admin,
            u.created_at,
            COUNT(le.id) AS total_logins,
            MAX(le.logged_in_at) AS last_login,
            ${directSummarySelect}
          FROM users u
          LEFT JOIN login_events le ON le.user_id = u.id
          WHERE (
            lower(u.fullname) LIKE ? ESCAPE '\\'
            OR lower(u.email) LIKE ? ESCAPE '\\'
          )
          GROUP BY u.id, u.fullname, u.email, u.is_admin, u.created_at
          ORDER BY
            CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END ASC,
            last_message_at DESC,
            CASE WHEN last_login IS NULL THEN 1 ELSE 0 END ASC,
            last_login DESC,
            CASE WHEN trim(u.fullname) = '' THEN lower(u.email) ELSE lower(u.fullname) END ASC,
            lower(u.email) ASC
          LIMIT ?
          `,
          [
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            safeQueryPattern,
            safeQueryPattern,
            limit,
          ]
        )
      : await all(
          `
          SELECT
            u.id,
            u.fullname,
            u.email,
            u.is_admin,
            u.created_at,
            COUNT(le.id) AS total_logins,
            MAX(le.logged_in_at) AS last_login,
            ${directSummarySelect}
          FROM users u
          LEFT JOIN login_events le ON le.user_id = u.id
          GROUP BY u.id, u.fullname, u.email, u.is_admin, u.created_at
          ORDER BY
            CASE WHEN last_message_at IS NULL THEN 1 ELSE 0 END ASC,
            last_message_at DESC,
            CASE WHEN last_login IS NULL THEN 1 ELSE 0 END ASC,
            last_login DESC,
            CASE WHEN trim(u.fullname) = '' THEN lower(u.email) ELSE lower(u.fullname) END ASC,
            lower(u.email) ASC
          LIMIT ?
          `,
          [
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            currentUserId,
            limit,
          ]
        );

    res.json({
      ok: true,
      query: hasQuery ? query : "",
      users: users.map((user) => ({
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        is_admin: Number(user.is_admin) === 1,
        created_at: user.created_at,
        total_logins: Number(user.total_logins) || 0,
        last_login: user.last_login || null,
        last_message_text: user.last_message_text || "",
        last_message_at: user.last_message_at || null,
        last_message_sender_user_id: Number(user.last_message_sender_user_id) || null,
        incoming_message_count: Number(user.incoming_message_count) || 0,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while fetching chat users." });
  }
});

app.get("/api/chat/messages", async (req, res) => {
  const scope = normalizeChatScope(req.query?.scope || "direct");
  const requestedLimit = parsePositiveInteger(req.query?.limit);
  const limit = Math.min(Math.max(requestedLimit || 120, 1), 300);

  if (!scope) {
    res.status(400).json({ ok: false, message: "scope must be 'all' or 'direct'." });
    return;
  }

  try {
    const currentUser = await requireAuthenticatedUser(req, res);
    if (!currentUser) {
      return;
    }
    const currentUserId = Number(currentUser.id);

    if (scope === "all") {
      const rows = await all(
        `
        SELECT
          m.id,
          m.sender_user_id,
          m.recipient_user_id,
          m.chat_scope,
          m.message_text,
          m.created_at,
          s.fullname AS sender_name,
          s.email AS sender_email
        FROM chat_messages m
        JOIN users s ON s.id = m.sender_user_id
        WHERE m.chat_scope = 'all'
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ?
        `,
        [limit]
      );

      res.json({
        ok: true,
        scope: "all",
        messages: rows.reverse().map(mapChatMessageRow).filter(Boolean),
      });
      return;
    }

    const peerUserId = parsePositiveInteger(req.query?.peerUserId);
    if (!peerUserId) {
      res.status(400).json({ ok: false, message: "peerUserId is required for direct chat." });
      return;
    }

    if (peerUserId === currentUserId) {
      res.status(400).json({ ok: false, message: "You cannot open direct chat with yourself." });
      return;
    }

    const peerUser = await get("SELECT id, fullname, email FROM users WHERE id = ?", [peerUserId]);
    if (!peerUser) {
      res.status(404).json({ ok: false, message: "Chat user not found." });
      return;
    }

    const rows = await all(
      `
      SELECT
        m.id,
        m.sender_user_id,
        m.recipient_user_id,
        m.chat_scope,
        m.message_text,
        m.created_at,
        s.fullname AS sender_name,
        s.email AS sender_email
      FROM chat_messages m
      JOIN users s ON s.id = m.sender_user_id
      WHERE m.chat_scope = 'direct'
        AND (
          (m.sender_user_id = ? AND m.recipient_user_id = ?)
          OR
          (m.sender_user_id = ? AND m.recipient_user_id = ?)
        )
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
      `,
      [currentUserId, peerUserId, peerUserId, currentUserId, limit]
    );

    res.json({
      ok: true,
      scope: "direct",
      peer: {
        id: peerUser.id,
        fullname: peerUser.fullname,
        email: peerUser.email,
      },
      messages: rows.reverse().map(mapChatMessageRow).filter(Boolean),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while fetching chat messages." });
  }
});

app.get("/api/chat/notifications", async (req, res) => {
  const requestedLimit = parsePositiveInteger(req.query?.limit);
  const limit = Math.min(Math.max(requestedLimit || 20, 1), 100);

  try {
    const currentUser = await requireAuthenticatedUser(req, res);
    if (!currentUser) {
      return;
    }
    const currentUserId = Number(currentUser.id);

    const rows = await all(
      `
      SELECT
        m.id,
        m.sender_user_id,
        m.recipient_user_id,
        m.chat_scope,
        m.message_text,
        m.created_at,
        s.fullname AS sender_name,
        s.email AS sender_email
      FROM chat_messages m
      JOIN users s ON s.id = m.sender_user_id
      WHERE m.sender_user_id != ?
        AND (
          (m.chat_scope = 'direct' AND m.recipient_user_id = ?)
          OR m.chat_scope = 'all'
        )
      ORDER BY m.created_at DESC, m.id DESC
      LIMIT ?
      `,
      [currentUserId, currentUserId, limit]
    );

    res.json({
      ok: true,
      notifications: rows.map((row) => ({
        id: row.id,
        scope: row.chat_scope === "all" ? "all" : "direct",
        sender: {
          id: row.sender_user_id,
          fullname: row.sender_name || row.sender_email || "Member",
          email: row.sender_email || "",
        },
        recipient_user_id: row.recipient_user_id,
        peer_user_id: row.chat_scope === "direct" ? row.sender_user_id : null,
        content: row.message_text,
        created_at: row.created_at,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while fetching chat notifications." });
  }
});

app.post("/api/chat/messages", async (req, res) => {
  const scope = normalizeChatScope(req.body?.scope || "direct");
  const content = normalizeChatContent(req.body?.content);

  if (!scope) {
    res.status(400).json({ ok: false, message: "scope must be 'all' or 'direct'." });
    return;
  }

  if (!content) {
    res.status(400).json({ ok: false, message: "Message cannot be empty." });
    return;
  }

  if (content.length > 1200) {
    res.status(400).json({ ok: false, message: "Message is too long. Max 1200 characters." });
    return;
  }

  try {
    const sender = await requireAuthenticatedUser(req, res);
    if (!sender) {
      return;
    }
    const senderUserId = Number(sender.id);

    let recipientUserId = null;
    if (scope === "direct") {
      recipientUserId = parsePositiveInteger(req.body?.recipientUserId);
      if (!recipientUserId) {
        res.status(400).json({ ok: false, message: "recipientUserId is required for direct chat." });
        return;
      }

      if (recipientUserId === senderUserId) {
        res.status(400).json({ ok: false, message: "You cannot message yourself in direct chat." });
        return;
      }

      const recipient = await get("SELECT id FROM users WHERE id = ?", [recipientUserId]);
      if (!recipient) {
        res.status(404).json({ ok: false, message: "Recipient user not found." });
        return;
      }
    }

    const inserted = await run(
      `
      INSERT INTO chat_messages (sender_user_id, recipient_user_id, chat_scope, message_text)
      VALUES (?, ?, ?, ?)
      `,
      [senderUserId, recipientUserId, scope, content]
    );

    const messageRow = await get(
      `
      SELECT
        m.id,
        m.sender_user_id,
        m.recipient_user_id,
        m.chat_scope,
        m.message_text,
        m.created_at,
        s.fullname AS sender_name,
        s.email AS sender_email
      FROM chat_messages m
      JOIN users s ON s.id = m.sender_user_id
      WHERE m.id = ?
      `,
      [inserted.lastID]
    );

    const responseMessage = mapChatMessageRow(messageRow);
    if (!responseMessage) {
      res.status(500).json({ ok: false, message: "Server error while loading sent message." });
      return;
    }

    res.status(201).json({
      ok: true,
      message: responseMessage,
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while sending message." });
  }
});

app.get("/api/stats/logins", async (req, res) => {
  try {
    const totalUsersRow = await get("SELECT COUNT(*) AS count FROM users");
    const totalLoginsRow = await get("SELECT COUNT(*) AS count FROM login_events");
    const uniqueUsersRow = await get("SELECT COUNT(DISTINCT user_id) AS count FROM login_events");
    const loginsTodayRow = await get(`
      SELECT COUNT(*) AS count
      FROM login_events
      WHERE date(logged_in_at, 'localtime') = date('now', 'localtime')
    `);

    res.json({
      ok: true,
      stats: {
        total_registered_users: totalUsersRow?.count || 0,
        total_successful_logins: totalLoginsRow?.count || 0,
        unique_users_logged_in: uniqueUsersRow?.count || 0,
        logins_today: loginsTodayRow?.count || 0,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while fetching stats." });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const users = await all(
      `
      SELECT
        u.id,
        u.fullname,
        u.email,
        u.is_admin,
        u.created_at,
        COUNT(le.id) AS total_logins,
        MAX(le.logged_in_at) AS last_login
      FROM users u
      LEFT JOIN login_events le ON le.user_id = u.id
      GROUP BY u.id, u.fullname, u.email, u.is_admin, u.created_at
      ORDER BY u.created_at DESC
      `
    );

    res.json({ ok: true, users });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while fetching users." });
  }
});

app.patch("/api/admin/users/:id/admin", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ ok: false, message: "Invalid user id." });
    return;
  }

  const adminFlag = toAdminFlag(req.body?.is_admin);
  if (adminFlag === null) {
    res.status(400).json({ ok: false, message: "is_admin must be true or false." });
    return;
  }

  try {
    const existing = await get("SELECT id, is_admin FROM users WHERE id = ?", [userId]);
    if (!existing) {
      res.status(404).json({ ok: false, message: "User not found." });
      return;
    }

    if (Number(existing.is_admin) === adminFlag) {
      res.json({
        ok: true,
        message: adminFlag ? "User is already an admin." : "User is already a regular user.",
      });
      return;
    }

    await run("UPDATE users SET is_admin = ? WHERE id = ?", [adminFlag, userId]);
    res.json({
      ok: true,
      message: adminFlag ? "User promoted to admin." : "Admin role removed.",
      user: {
        id: userId,
        is_admin: adminFlag,
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while updating admin role." });
  }
});

app.delete("/api/admin/users/:id", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ ok: false, message: "Invalid user id." });
    return;
  }

  try {
    const existing = await get("SELECT id FROM users WHERE id = ?", [userId]);
    if (!existing) {
      res.status(404).json({ ok: false, message: "User not found." });
      return;
    }

    await run("DELETE FROM chat_messages WHERE sender_user_id = ? OR recipient_user_id = ?", [userId, userId]);
    await run("DELETE FROM login_events WHERE user_id = ?", [userId]);
    await run("DELETE FROM users WHERE id = ?", [userId]);
    res.json({ ok: true, message: "User and related logins deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while deleting user." });
  }
});

app.delete("/api/admin/users/:id/logins", async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(400).json({ ok: false, message: "Invalid user id." });
    return;
  }

  try {
    await run("DELETE FROM login_events WHERE user_id = ?", [userId]);
    res.json({ ok: true, message: "User login history deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while deleting user logins." });
  }
});

app.delete("/api/admin/logins", async (req, res) => {
  try {
    await run("DELETE FROM login_events");
    res.json({ ok: true, message: "All login history deleted." });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while clearing login history." });
  }
});

app.post("/api/auth/signup", async (req, res) => {
  const fullname = String(req.body?.fullname || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!fullname || !email || !password) {
    res.status(400).json({ ok: false, message: "All fields are required." });
    return;
  }

  if (!isValidEmailAddress(email)) {
    res.status(400).json({ ok: false, message: "Enter a valid email address." });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ ok: false, message: "Password must be at least 6 characters." });
    return;
  }

  try {
    const existing = await get("SELECT id FROM users WHERE email = ?", [email]);
    if (existing) {
      res.status(409).json({ ok: false, message: "An account with this email already exists." });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const isAdmin = isOwnerAdminEmail(email) ? 1 : 0;
    const result = await run(
      "INSERT INTO users (fullname, email, password_hash, is_admin) VALUES (?, ?, ?, ?)",
      [fullname, email, passwordHash, isAdmin]
    );

    res.status(201).json({
      ok: true,
      message: "Account created successfully.",
      user: {
        id: result.lastID,
        fullname,
        email,
        is_admin: isAdmin === 1,
        auth_token: createAuthToken({
          id: result.lastID,
          email,
        }),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while creating account." });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const newPassword = String(req.body?.newPassword || "");

  if (!email || !newPassword) {
    res.status(400).json({ ok: false, message: "Email and new password are required." });
    return;
  }

  if (!isValidEmailAddress(email)) {
    res.status(400).json({ ok: false, message: "Enter a valid email address." });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({ ok: false, message: "Password must be at least 6 characters." });
    return;
  }

  try {
    const user = await get("SELECT id, fullname, email, is_admin FROM users WHERE lower(email) = lower(?)", [email]);
    if (!user) {
      res.status(404).json({ ok: false, message: "No account was found with this email." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, user.id]);
    const updatedUser = await promoteOwnerAdminIfNeeded(user);

    res.json({
      ok: true,
      message: "Password reset successful.",
      user: {
        id: updatedUser.id,
        fullname: updatedUser.fullname,
        email: updatedUser.email,
        is_admin: Number(updatedUser.is_admin) === 1,
        auth_token: createAuthToken(updatedUser),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while resetting password." });
  }
});

app.post("/api/auth/admin/login", async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    res.status(400).json({ ok: false, message: "Email and password are required." });
    return;
  }

  try {
    let user = await get(
      "SELECT id, fullname, email, password_hash, is_admin FROM users WHERE email = ?",
      [identifier]
    );

    if (!user) {
      res.status(401).json({ ok: false, message: "Invalid email or password." });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ ok: false, message: "Invalid email or password." });
      return;
    }

    user = await promoteOwnerAdminIfNeeded(user);

    if (Number(user.is_admin) !== 1) {
      res.status(403).json({ ok: false, message: "Access denied. Admin account required." });
      return;
    }

    await run("INSERT INTO login_events (user_id) VALUES (?)", [user.id]);

    res.json({
      ok: true,
      message: "Admin login successful.",
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        is_admin: true,
        auth_token: createAuthToken(user),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while logging in." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const identifier = String(req.body?.identifier || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!identifier || !password) {
    res.status(400).json({ ok: false, message: "Email and password are required." });
    return;
  }

  try {
    let user = await get(
      "SELECT id, fullname, email, password_hash, is_admin FROM users WHERE email = ?",
      [identifier]
    );

    if (!user) {
      res.status(401).json({ ok: false, message: "Invalid email or password." });
      return;
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatches) {
      res.status(401).json({ ok: false, message: "Invalid email or password." });
      return;
    }

    user = await promoteOwnerAdminIfNeeded(user);

    await run("INSERT INTO login_events (user_id) VALUES (?)", [user.id]);

    res.json({
      ok: true,
      message: "Login successful.",
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        is_admin: Number(user.is_admin) === 1,
        auth_token: createAuthToken(user),
      },
    });
  } catch (error) {
    res.status(500).json({ ok: false, message: "Server error while logging in." });
  }
});

ensureConfiguredOwnerAdmin();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Auth server running on http://0.0.0.0:${PORT}`);
  console.log(`SQLite database: ${dbPath}`);
});
