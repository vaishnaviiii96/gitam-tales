const express = require("express");
const pool = require("../db");
const { verifyToken } = require("../middleware/auth");

const router = express.Router();

/* ======================
   GET CURRENT USER
====================== */
router.get("/me", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, bio, branch, year, campus, linkedin_url, github_url, profile_picture, skills, created_at, is_admin FROM users WHERE id = $1",
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ user: result.rows[0] });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   GET PUBLIC PROFILE
====================== */
router.get("/profile/:id", async (req, res) => {
  try {
    const { id } = req.params;
    // Check if a logged-in user is viewing (for user_has_liked)
    let currentUserId = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
            currentUserId = decoded.id;
        } catch (e) {}
    }

    const userResult = await pool.query(
      `SELECT id, name, bio, branch, year, campus, linkedin_url, github_url, profile_picture, skills, created_at, is_admin
       FROM users WHERE id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const talesResult = await pool.query(
      `SELECT t.*,
          COUNT(DISTINCT l.id)::int AS like_count,
          COUNT(DISTINCT c.id)::int AS comment_count,
          EXISTS (
              SELECT 1 FROM likes ul
              WHERE ul.post_id = t.id
              AND ul.user_id::text = $2
          ) AS user_has_liked
       FROM tales t
       LEFT JOIN likes l ON l.post_id = t.id
       LEFT JOIN comments c ON c.tale_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [id, currentUserId || '00000000-0000-0000-0000-000000000000']
    );
    res.status(200).json({
      user: userResult.rows[0],
      tales: talesResult.rows
    });

  } catch (err) {
    console.error("Get public profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   UPDATE PROFILE
====================== */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { name, bio, branch, year, campus, linkedin_url, github_url, skills } = req.body;

    const validCampuses = ['Hyderabad', 'Visakhapatnam', 'Bangalore'];
    if (campus && !validCampuses.includes(campus)) {
      return res.status(400).json({ error: "Invalid campus. Must be Hyderabad, Visakhapatnam, or Bangalore" });
    }

    // Moderate bio
    if (bio && bio.trim().length > 0) {
      const { moderate } = require('../utils/moderator');
      const bioCheck = await moderate(bio, 'description');
      if (!bioCheck.allowed) {
        return res.status(400).json({ error: bioCheck.reason });
      }
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) { updates.push(`name = $${paramCount}`); values.push(name); paramCount++; }
    if (bio !== undefined) { updates.push(`bio = $${paramCount}`); values.push(bio); paramCount++; }
    if (branch !== undefined) { updates.push(`branch = $${paramCount}`); values.push(branch); paramCount++; }
    if (year !== undefined) { updates.push(`year = $${paramCount}`); values.push(year); paramCount++; }
    if (campus !== undefined) { updates.push(`campus = $${paramCount}`); values.push(campus); paramCount++; }
    if (linkedin_url !== undefined) { updates.push(`linkedin_url = $${paramCount}`); values.push(linkedin_url); paramCount++; }
    if (github_url !== undefined) { updates.push(`github_url = $${paramCount}`); values.push(github_url); paramCount++; }
    if (skills !== undefined) { updates.push(`skills = $${paramCount}`); values.push(skills); paramCount++; }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields to update" });
    }

    values.push(req.user.id);

    const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, email, bio, branch, year, campus, linkedin_url, github_url, skills, created_at
    `;

    const result = await pool.query(query, values);

    res.status(200).json({
      message: "Profile updated successfully",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   UPLOAD PROFILE PICTURE
====================== */
router.put("/profile-picture", verifyToken, async (req, res) => {
  try {
    const { profile_picture } = req.body;

    if (!profile_picture) {
      return res.status(400).json({ error: "No image data provided" });
    }

    if (!profile_picture.startsWith('data:image/')) {
      return res.status(400).json({ error: "Invalid image format" });
    }

    const result = await pool.query(
      `UPDATE users 
       SET profile_picture = $1 
       WHERE id = $2 
       RETURNING id, name, email, profile_picture`,
      [profile_picture, req.user.id]
    );

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: result.rows[0]
    });

  } catch (err) {
    console.error("Upload profile picture error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* ======================
   SEARCH USERS
====================== */
router.get("/search", async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: "Search query too short" });
    }

    const result = await pool.query(
      `SELECT id, name, branch, campus, profile_picture
       FROM users
       WHERE name ILIKE $1
       LIMIT 10`,
      [`%${q.trim()}%`]
    );

    res.status(200).json({ users: result.rows });
  } catch (err) {
    console.error("Search users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
