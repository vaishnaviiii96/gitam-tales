const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/auth');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const { moderateComment, moderate } = require('../utils/moderator');

// Cloudinary automatically picks up CLOUDINARY_URL from process.env
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'gitam_tales/covers',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'gif'],
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/tales - Create a new tale
router.post('/', verifyToken, upload.single('cover_image'), async (req, res) => {
    try {
        const { title, category, description, tags, event_date, created_at } = req.body;
        const userId = req.user.id;
        const coverImage = req.file ? req.file.path : null;

        const titleCheck = await moderate(title, 'title');
        if (!titleCheck.allowed) {
            return res.status(400).json({ message: titleCheck.reason });
        }

        if (description) {
            const descCheck = await moderate(description, 'description');
            if (!descCheck.allowed) {
                return res.status(400).json({ message: descCheck.reason });
            }
        }

        if (tags) {
            const tagsCheck = await moderate(tags, 'tags');
            if (!tagsCheck.allowed) {
                return res.status(400).json({ message: tagsCheck.reason });
            }
        }

        const result = await pool.query(
            `INSERT INTO tales (user_id, title, category, description, tags, event_date, cover_image, created_at) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING *`,
            [userId, title, category, description, tags, event_date, coverImage, created_at || new Date()]
        );

        const newTale = result.rows[0];

        // If admin posted, notify all non-admin users
        const userCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        console.log('=== ADMIN POST NOTIF DEBUG ===');
        console.log('userId:', userId, typeof userId);
        console.log('is_admin row:', userCheck.rows[0]);

        if (userCheck.rows[0]?.is_admin) {
            console.log('Admin confirmed, fetching users...');
            try {
                const allUsers = await pool.query(
                    `SELECT id FROM users WHERE is_admin = FALSE AND id != $1`,
                    [userId]
                );
                console.log('Users to notify:', allUsers.rows);

                if (allUsers.rows.length > 0) {
                    
                    const insertValues = allUsers.rows.map((_, i) =>
                        `($${i * 3 + 1}, $${i * 3 + 2}, 'admin_post', $${i * 3 + 3})`
                    ).join(', ');
                    const insertParams = allUsers.rows.flatMap(u => [u.id, userId, newTale.id]);
                    const insertResult = await pool.query(
                        `INSERT INTO notifications (recipient_id, sender_id, type, tale_id) VALUES ${insertValues}`,
                        insertParams
                    );
                    console.log('INSERT result:', insertResult.rowCount, 'rows inserted');
                }
            } catch (notifErr) {
                console.error('NOTIF ERROR admin_post:', notifErr.message);
                console.error('Full error:', notifErr);
            }
        } else {
            console.log('NOT admin, skipping notifications');
        }

        res.status(201).json({
            success: true,
            tale: newTale
        });
    } catch (error) {
        console.error('Error creating tale:', error);
        res.status(500).json({ message: 'Error creating tale', error: error.message });
    }
});

// GET /api/tales/user - Get all tales for the logged-in user
router.get('/user', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await pool.query(
            `SELECT t.*,
                COUNT(DISTINCT l.id)::int AS like_count,
                COUNT(DISTINCT c.id)::int AS comment_count,
                EXISTS (
                    SELECT 1 FROM likes ul
                    WHERE ul.post_id = t.id
                    AND ul.user_id = $1
                ) AS user_has_liked
             FROM tales t
             LEFT JOIN likes l ON l.post_id = t.id
             LEFT JOIN comments c ON c.tale_id = t.id AND c.parent_id IS NULL
             WHERE t.user_id = $1
             GROUP BY t.id
             ORDER BY t.created_at DESC`,
            [userId]
        );

        res.status(200).json({
            success: true,
            tales: result.rows
        });
    } catch (error) {
        console.error('Error fetching tales:', error);
        res.status(500).json({ message: 'Error fetching tales', error: error.message });
    }
});

// GET /api/tales/public - Get all public tales with author info (for discover & homepage)
router.get('/public', async (req, res) => {
    try {
        const { sort, campus, limit = 50, exclude_user_id } = req.query;

        // Get current user from token if present (for user_has_liked)
        let currentUserId = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
                currentUserId = decoded.id;
            } catch (e) {}
        }

        // Build WHERE clauses
        const conditions = [];
        const values = [];

        if (campus) {
            values.push(campus);
            conditions.push(`u.campus = $${values.length}`);
        }

        if (exclude_user_id) {
            values.push(exclude_user_id.toString());
            conditions.push(`t.user_id::text != $${values.length}`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // user_has_liked subquery
        let userLikedSubquery = 'FALSE';
        if (currentUserId) {
            values.push(currentUserId.toString());
            userLikedSubquery = `EXISTS (
                SELECT 1 FROM likes ul
                WHERE ul.post_id = t.id
                AND ul.user_id::text = $${values.length}
            )`;
        }

        // Build sort order — applied on the OUTER query so aliases are resolved
        let orderBy = 'ORDER BY created_at DESC'; // default: newest first
        if (sort === 'oldest') {
            orderBy = 'ORDER BY created_at ASC';
        } else if (sort === 'top') {
            orderBy = 'ORDER BY like_count DESC';
        } else if (sort === 'trending') {
            orderBy = 'ORDER BY trending_likes DESC';
        }

        // Add limit
        values.push(parseInt(limit));
        const limitParam = `$${values.length}`;

        // Wrap in a subquery so ORDER BY can reference the aggregate aliases
        const query = `
            SELECT * FROM (
                SELECT 
                    t.*,
                    u.name AS author_name,
                    u.profile_picture AS author_avatar,
                    u.branch AS author_branch,
                    u.campus AS author_campus,
                    u.year AS author_year,
                    u.is_admin AS author_is_admin,
                    COUNT(DISTINCT l.id)::int AS like_count,
                    COUNT(DISTINCT c.id)::int AS comment_count,
                    COUNT(DISTINCT CASE WHEN l.created_at > NOW() - INTERVAL '7 days' THEN l.id END)::int AS trending_likes,
                    ${userLikedSubquery} AS user_has_liked
                FROM tales t
                JOIN users u ON t.user_id = u.id
                LEFT JOIN likes l ON l.post_id = t.id
                LEFT JOIN comments c ON c.tale_id = t.id
                ${whereClause}
                GROUP BY t.id, u.name, u.profile_picture, u.branch, u.campus, u.year, u.is_admin
            ) AS tale_data
            ${orderBy}
            LIMIT ${limitParam}
        `;

        const result = await pool.query(query, values);

        res.status(200).json({
            success: true,
            tales: result.rows
        });
    } catch (error) {
        console.error('Error fetching public tales:', error);
        res.status(500).json({ message: 'Error fetching tales', error: error.message });
    }
});

// GET /api/tales/counts - for homepage counters
router.get('/counts', async (req, res) => {
    try {
        const talesCount = await pool.query('SELECT COUNT(*) FROM tales');
        const usersCount = await pool.query('SELECT COUNT(*) FROM users');

        res.status(200).json({
            success: true,
            total_tales: parseInt(talesCount.rows[0].count),
            total_users: parseInt(usersCount.rows[0].count)
        });
    } catch (error) {
        console.error('Error fetching counts:', error);
        res.status(500).json({ message: 'Error fetching counts', error: error.message });
    }
});

// PUT /api/tales/:id - Edit a tale
router.put('/:id', verifyToken, upload.single('cover_image'), async (req, res) => {
    try {
        const { title, category, description, tags, event_date } = req.body;
        const userId = req.user.id;
        const taleId = req.params.id;

        const check = await pool.query('SELECT id FROM tales WHERE id = $1 AND user_id = $2', [taleId, userId]);
        if (check.rows.length === 0) return res.status(403).json({ message: 'Not authorized' });

        const titleCheck = await moderate(title, 'title');
        if (!titleCheck.allowed) {
            return res.status(400).json({ message: titleCheck.reason });
        }

        if (description) {
            const descCheck = await moderate(description, 'description');
            if (!descCheck.allowed) {
                return res.status(400).json({ message: descCheck.reason });
            }
        }

        if (tags) {
            const tagsCheck = await moderate(tags, 'tags');
            if (!tagsCheck.allowed) {
                return res.status(400).json({ message: tagsCheck.reason });
            }
        }

        const coverImage = req.file ? req.file.path : null;

        let query, values;
        if (coverImage) {
            query = `UPDATE tales SET title=$1, category=$2, description=$3, tags=$4, event_date=$5, cover_image=$6 WHERE id=$7 AND user_id=$8 RETURNING *`;
            values = [title, category, description, tags, event_date || null, coverImage, taleId, userId];
        } else {
            query = `UPDATE tales SET title=$1, category=$2, description=$3, tags=$4, event_date=$5 WHERE id=$6 AND user_id=$7 RETURNING *`;
            values = [title, category, description, tags, event_date || null, taleId, userId];
        }

        const result = await pool.query(query, values);
        res.status(200).json({ success: true, tale: result.rows[0] });
    } catch (error) {
        console.error('Error updating tale:', error);
        res.status(500).json({ message: 'Error updating tale', error: error.message });
    }
});

// DELETE /api/tales/:id - Delete a tale
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taleId = req.params.id;

        const check = await pool.query('SELECT id FROM tales WHERE id = $1 AND user_id = $2', [taleId, userId]);
        if (check.rows.length === 0) return res.status(403).json({ message: 'Not authorized' });

        await pool.query('DELETE FROM tales WHERE id = $1 AND user_id = $2', [taleId, userId]);
        res.status(200).json({ success: true, message: 'Tale deleted' });
    } catch (error) {
        console.error('Error deleting tale:', error);
        res.status(500).json({ message: 'Error deleting tale', error: error.message });
    }
});

// POST /api/tales/:id/like - Like a tale
router.post('/:id/like', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taleId = req.params.id;

        const taleCheck = await pool.query('SELECT id FROM tales WHERE id = $1', [taleId]);
        if (taleCheck.rows.length === 0) return res.status(404).json({ message: 'Tale not found' });

        await pool.query(
            `INSERT INTO likes (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [userId, taleId]
        );

        const countResult = await pool.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [taleId]);

        try {
            const tale = await pool.query('SELECT user_id FROM tales WHERE id = $1', [taleId]);
            if (tale.rows.length > 0 && tale.rows[0].user_id.toString() !== userId.toString()) {
                await pool.query(
                    `INSERT INTO notifications (recipient_id, sender_id, type, tale_id)
                     VALUES ($1, $2, 'like', $3)`,
                    [tale.rows[0].user_id, userId, parseInt(taleId)]
                );
            }
        } catch (notifErr) {
            console.error('NOTIF ERROR like:', notifErr.message);
        }

        res.status(200).json({ success: true, like_count: parseInt(countResult.rows[0].count) });

    } catch (error) {
        console.error('Error liking tale:', error);
        res.status(500).json({ message: 'Error liking tale', error: error.message });
    }
});

// DELETE /api/tales/:id/like - Unlike a tale
router.delete('/:id/like', verifyToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const taleId = req.params.id;

        await pool.query(
            `DELETE FROM likes WHERE user_id = $1 AND post_id = $2`,
            [userId, taleId]
        );

        const countResult = await pool.query('SELECT COUNT(*) FROM likes WHERE post_id = $1', [taleId]);
        res.status(200).json({ success: true, like_count: parseInt(countResult.rows[0].count) });

    } catch (error) {
        console.error('Error unliking tale:', error);
        res.status(500).json({ message: 'Error unliking tale', error: error.message });
    }
});

// GET all comments for a tale (public)
router.get('/:id/comments', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `SELECT 
                comments.id,
                comments.content,
                comments.created_at,
                comments.parent_id,
                users.id AS user_id,
                users.name,
                users.profile_picture,
                users.is_admin
            FROM comments
            JOIN users ON comments.user_id = users.id
            WHERE comments.tale_id = $1
            ORDER BY comments.created_at ASC`,
            [id]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Get comments error:', err.message);
        res.status(500).json({ error: 'Failed to fetch comments.' });
    }
});

// POST a new comment on a tale (requires JWT)
router.post('/:id/comments', verifyToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { content, parent_id } = req.body;

        const moderation = await moderateComment(content);
        if (!moderation.allowed) {
            return res.status(400).json({ error: moderation.reason });
        }

        const result = await pool.query(
            `INSERT INTO comments (tale_id, user_id, content, parent_id)
            VALUES ($1, $2, $3, $4)
            RETURNING id, content, created_at, parent_id`,
            [id, req.user.id, content, parent_id || null]
        );

        const user = await pool.query(
            `SELECT id, name, profile_picture FROM users WHERE id = $1`,
            [req.user.id]
        );

        const tale = await pool.query('SELECT user_id FROM tales WHERE id = $1', [id]);
        if (tale.rows.length > 0 && tale.rows[0].user_id.toString() !== req.user.id.toString()) {
            const notifType = parent_id ? 'reply' : 'comment';
            await pool.query(
                `INSERT INTO notifications (recipient_id, sender_id, type, tale_id, comment_id)
                 VALUES ($1, $2, $3, $4, $5)`,
                [tale.rows[0].user_id, req.user.id, notifType, id, result.rows[0].id]
            );
        }

        if (parent_id) {
            const parentComment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [parent_id]);
            if (parentComment.rows.length > 0 &&
                parentComment.rows[0].user_id.toString() !== req.user.id.toString() &&
                parentComment.rows[0].user_id.toString() !== tale.rows[0]?.user_id?.toString()) {
                await pool.query(
                    `INSERT INTO notifications (recipient_id, sender_id, type, tale_id, comment_id)
                     VALUES ($1, $2, 'reply', $3, $4)`,
                    [parentComment.rows[0].user_id, req.user.id, id, result.rows[0].id]
                );
            }
        }

        res.status(201).json({
            ...result.rows[0],
            user_id: user.rows[0].id,
            name: user.rows[0].name,
            profile_picture: user.rows[0].profile_picture,
            parent_id: parent_id || null
        });

    } catch (err) {
        console.error('Post comment error:', err.message);
        res.status(500).json({ error: 'Failed to post comment.' });
    }
});

// DELETE a comment (only your own)
router.delete('/:taleId/comments/:commentId', verifyToken, async (req, res) => {
    try {
        const { taleId, commentId } = req.params;

        const check = await pool.query(
            `SELECT id FROM comments WHERE id = $1 AND user_id = $2 AND tale_id = $3`,
            [commentId, req.user.id, taleId]
        );

        if (check.rows.length === 0) {
            return res.status(403).json({ error: 'You can only delete your own comments.' });
        }

        await pool.query(`DELETE FROM comments WHERE id = $1`, [commentId]);

        res.json({ message: 'Comment deleted.' });
    } catch (err) {
        console.error('Delete comment error:', err.message);
        res.status(500).json({ error: 'Failed to delete comment.' });
    }
});

module.exports = router;
