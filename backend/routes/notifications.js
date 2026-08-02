const express = require("express");
const router = express.Router();
const pool = require("../db");
const { verifyToken } = require('../middleware/auth');

router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT n.*,
              s.name AS sender_name,
              s.profile_picture AS sender_avatar,
              t.title AS tale_title,
              t.user_id AS tale_owner_id
       FROM notifications n
       JOIN users s ON s.id = n.sender_id
       LEFT JOIN tales t ON t.id = n.tale_id
       WHERE n.recipient_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});
// PUT /api/notifications/read/:id — mark single notification as read
router.put("/read/:id", verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND recipient_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    console.error("Mark single read error:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
});
// PUT /api/notifications/read — mark all as read
router.put("/read", verifyToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = TRUE WHERE recipient_id = $1`,
      [req.user.id]
    );
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
});

module.exports = router;
