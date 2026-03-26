const { Router } = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const prisma = require("../config/db");
const { requireAuth } = require("../middleware/auth");

const router = Router();

const uploadDir = path.join(__dirname, "../../uploads/avatars");
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".png";
    cb(null, `${req.user.id}-${Date.now()}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Update profile fields (name)
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name } = req.body || {};
    const data = {};

    if (typeof name === "string") {
      const trimmed = name.trim();
      if (trimmed.length < 3) return res.status(400).json({ error: "Name must be at least 3 characters" });
      if (trimmed.length > 100) return res.status(400).json({ error: "Name is too long" });
      data.name = trimmed;
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("[Users] Update me error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Upload avatar (multipart/form-data field: avatar)
router.post("/me/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Avatar file is required" });

    const rel = `/uploads/avatars/${req.file.filename}`;
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatarUrl: rel },
      select: { id: true, name: true, email: true, avatarUrl: true, createdAt: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("[Users] Upload avatar error:", err);
    res.status(500).json({ error: "Failed to upload avatar" });
  }
});

module.exports = router;

