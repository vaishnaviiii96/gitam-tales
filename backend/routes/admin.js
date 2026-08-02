const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');

// ── Middleware: admin only ────────────────────────────────────────────────────
async function verifyAdmin(req, res, next) {
    try {
        const result = await pool.query(
            'SELECT is_admin FROM users WHERE id = $1',
            [req.user.id]
        );
        if (result.rows.length === 0 || !result.rows[0].is_admin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (err) {
        console.error('Admin check error:', err);
        res.status(500).json({ error: 'Server error' });
    }
}

// All admin routes require both a valid token AND admin flag
router.use(verifyToken, verifyAdmin);

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [users, tales, comments] = await Promise.all([
            pool.query('SELECT COUNT(*) FROM users'),
            pool.query('SELECT COUNT(*) FROM tales'),
            pool.query('SELECT COUNT(*) FROM comments'),
        ]);
        res.json({
            total_users:    parseInt(users.rows[0].count),
            total_tales:    parseInt(tales.rows[0].count),
            total_comments: parseInt(comments.rows[0].count),
        });
    } catch (err) {
        console.error('Admin stats error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                u.id, u.name, u.email, u.branch, u.campus, u.is_admin, u.created_at,
                COUNT(DISTINCT t.id)::int AS tale_count,
                COUNT(DISTINCT c.id)::int AS comment_count
             FROM users u
             LEFT JOIN tales t ON t.user_id = u.id
             LEFT JOIN comments c ON c.user_id = u.id
             GROUP BY u.id
             ORDER BY u.created_at DESC`
        );
        res.json({ users: result.rows });
    } catch (err) {
        console.error('Admin get users error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Prevent admin from deleting themselves
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'You cannot delete your own account' });
        }

        // Prevent deleting other admins
        const check = await pool.query('SELECT is_admin FROM users WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'User not found' });
        if (check.rows[0].is_admin) return res.status(400).json({ error: 'Cannot delete another admin' });

        // Cascade: comments → likes → tales → user
        await pool.query('DELETE FROM comments WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM likes WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM tales WHERE user_id = $1', [id]);
        await pool.query('DELETE FROM users WHERE id = $1', [id]);

        res.json({ success: true, message: 'User and all their data deleted' });
    } catch (err) {
        console.error('Admin delete user error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/tales ──────────────────────────────────────────────────────
router.get('/tales', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                t.id, t.title, t.category, t.created_at,
                u.name AS author_name, u.email AS author_email,
                COUNT(DISTINCT l.id)::int AS like_count,
                COUNT(DISTINCT c.id)::int AS comment_count
             FROM tales t
             JOIN users u ON t.user_id = u.id
             LEFT JOIN likes l ON l.post_id = t.id
             LEFT JOIN comments c ON c.tale_id = t.id
             GROUP BY t.id, u.name, u.email
             ORDER BY t.created_at DESC`
        );
        res.json({ tales: result.rows });
    } catch (err) {
        console.error('Admin get tales error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── DELETE /api/admin/tales/:id ───────────────────────────────────────────────
router.delete('/tales/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT id FROM tales WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Tale not found' });

        await pool.query('DELETE FROM comments WHERE tale_id = $1', [id]);
        await pool.query('DELETE FROM likes WHERE post_id = $1', [id]);
        await pool.query('DELETE FROM tales WHERE id = $1', [id]);

        res.json({ success: true, message: 'Tale deleted' });
    } catch (err) {
        console.error('Admin delete tale error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── GET /api/admin/comments ───────────────────────────────────────────────────
router.get('/comments', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                c.id, c.content, c.created_at,
                u.name AS author_name, u.email AS author_email,
                t.title AS tale_title, t.id AS tale_id
             FROM comments c
             JOIN users u ON c.user_id = u.id
             JOIN tales t ON c.tale_id = t.id
             ORDER BY c.created_at DESC
             LIMIT 200`
        );
        res.json({ comments: result.rows });
    } catch (err) {
        console.error('Admin get comments error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ── DELETE /api/admin/comments/:id ───────────────────────────────────────────
router.delete('/comments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const check = await pool.query('SELECT id FROM comments WHERE id = $1', [id]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });

        await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        res.json({ success: true, message: 'Comment deleted' });
    } catch (err) {
        console.error('Admin delete comment error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
