const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const path = require('path');

// Ρύθμιση αποθήκευσης αρχείων PDF
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/pdfs/');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed!'));
        }
    }
});



// 1. Προβολή και Δημιουργία θεμάτων προς ανάθεση
router.get('/topics', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            'SELECT id, title, description, description_pdf_url FROM thesis WHERE supervisor_id = ?',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Create new topic 
router.post('/topics', async (req, res) => {
    const { title, description, description_pdf_url } = req.body;
    try {
        await db.pool.query(
            'INSERT INTO thesis (title, description, description_pdf_url, supervisor_id, status, student_id) VALUES (?, ?, ?, ?, "under_assignment", 0)',
            [title, description, description_pdf_url || null, req.user.id]
        );
        res.status(201).json({ message: 'Topic created' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Edit topic
router.put('/topics/:id', async (req, res) => {
    const { title, description, description_pdf_url } = req.body;
    try {
        await db.pool.query(
            'UPDATE thesis SET title = ?, description = ?, description_pdf_url = ? WHERE id = ? AND supervisor_id = ?',
            [title, description, description_pdf_url || null, req.params.id, req.user.id]
        );
        res.json({ message: 'Topic updated' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Create new topic with PDF upload
router.post('/topics', upload.single('pdf'), async (req, res) => {
    const { title, description } = req.body;
    let description_pdf_url = null;
    if (req.file) {
        description_pdf_url = `/uploads/pdfs/${req.file.filename}`;
    }
    try {
        await db.pool.query(
            'INSERT INTO thesis (title, description, description_pdf_url, supervisor_id, status, student_id) VALUES (?, ?, ?, ?, "under_assignment", 0)',
            [title, description, description_pdf_url, req.user.id]
        );
        res.status(201).json({ message: 'Topic created', pdf: description_pdf_url });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});



// 2. Αρχική ανάθεση θέματος σε φοιτητή
// Assign topic to student
router.post('/assign', async (req, res) => {
    const { thesis_id, student_id } = req.body;
    try {
        await db.pool.query(
            'UPDATE thesis SET student_id = ?, status = "under_assignment" WHERE id = ? AND supervisor_id = ?',
            [student_id, thesis_id, req.user.id]
        );
        res.json({ message: 'Topic assigned to student' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Undo assignment
router.delete('/assign/:id', async (req, res) => {
    try {
        await db.pool.query(
            'UPDATE thesis SET student_id = 0, status = "under_assignment" WHERE id = ? AND supervisor_id = ? AND status = "under_assignment"',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Assignment undone' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});



// 3. Προβολή λίστας διπλωματικών
// List all theses professor participates in (supervisor or committee member)
router.get('/theses', async (req, res) => {
    const { status, role } = req.query;
    let query = `
        SELECT t.*, cm.role AS committee_role
        FROM thesis t
        LEFT JOIN committee_members cm ON cm.thesis_id = t.id AND cm.professor_id = ?
        WHERE t.supervisor_id = ? OR cm.professor_id = ?
    `;
    const params = [req.user.id, req.user.id, req.user.id];
    if (status) {
        query += ' AND t.status = ?';
        params.push(status);
    }
    if (role) {
        query += ' AND cm.role = ?';
        params.push(role);
    }
    try {
        const [rows] = await db.pool.query(query, params);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get thesis details
router.get('/theses/:id', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT t.*, 
                s.name AS student_name, s.surname AS student_surname, 
                sup.name AS supervisor_name, sup.surname AS supervisor_surname
            FROM thesis t
            LEFT JOIN users s ON t.student_id = s.id
            LEFT JOIN users sup ON t.supervisor_id = sup.id
            WHERE t.id = ?`,
            [req.params.id]
        );
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Export thesis list as CSV or JSON
router.get('/theses/export', async (req, res) => {
    const format = req.query.format || 'json';
    try {
        const [rows] = await db.pool.query(
            'SELECT * FROM thesis WHERE supervisor_id = ?',
            [req.user.id]
        );
        if (format === 'csv') {
            const csv = [
                Object.keys(rows[0] || {}).join(','),
                ...rows.map(row => Object.values(row).join(','))
            ].join('\n');
            res.header('Content-Type', 'text/csv');
            res.send(csv);
        } else {
            res.json(rows);
        }
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});



// 4. Προβολή προσκλήσεων συμμετοχής σε τριμελή
// List active invitations
router.get('/committee-invitations', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT ci.*, t.title AS thesis_title
             FROM committee_invitations ci
             JOIN thesis t ON ci.thesis_id = t.id
             WHERE ci.invited_professor_id = ? AND ci.status = 'pending'`,
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Accept invitation
router.post('/committee-invitations/:id/accept', async (req, res) => {
    try {
        await db.pool.query(
            `UPDATE committee_invitations SET status = 'accepted', response_date = NOW() 
             WHERE id = ? AND invited_professor_id = ?`,
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Invitation accepted' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Reject invitation
router.post('/committee-invitations/:id/reject', async (req, res) => {
    try {
        await db.pool.query(
            `UPDATE committee_invitations SET status = 'declined', response_date = NOW() 
             WHERE id = ? AND invited_professor_id = ?`,
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Invitation rejected' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

module.exports = router;



// 5) Προβολή στατιστικών
router.get('/stats', async (req, res) => {
    try {
        // i. Μέσος χρόνος περάτωσης (σε ημέρες)
        const [supervised] = await db.pool.query(
            `SELECT AVG(DATEDIFF(t.presentation_date, t.assignment_date)) AS avg_days
             FROM thesis t
             WHERE t.supervisor_id = ? AND t.status = 'completed' AND t.assignment_date IS NOT NULL AND t.presentation_date IS NOT NULL`,
            [req.user.id]
        );
        const [committee] = await db.pool.query(
            `SELECT AVG(DATEDIFF(t.presentation_date, t.assignment_date)) AS avg_days
             FROM thesis t
             JOIN committee_members cm ON cm.thesis_id = t.id
             WHERE cm.professor_id = ? AND t.status = 'completed' AND t.assignment_date IS NOT NULL AND t.presentation_date IS NOT NULL`,
            [req.user.id]
        );

        // ii. Μέσος βαθμός
        const [avg_grade_supervised] = await db.pool.query(
            `SELECT AVG(grade) AS avg_grade FROM thesis WHERE supervisor_id = ? AND status = 'completed' AND grade IS NOT NULL`,
            [req.user.id]
        );
        const [avg_grade_committee] = await db.pool.query(
            `SELECT AVG(cm.grade) AS avg_grade
             FROM committee_members cm
             JOIN thesis t ON t.id = cm.thesis_id
             WHERE cm.professor_id = ? AND t.status = 'completed' AND cm.grade IS NOT NULL`,
            [req.user.id]
        );

        // iii. Συνολικό πλήθος διπλωματικών
        const [count_supervised] = await db.pool.query(
            `SELECT COUNT(*) AS total FROM thesis WHERE supervisor_id = ?`,
            [req.user.id]
        );
        const [count_committee] = await db.pool.query(
            `SELECT COUNT(*) AS total
             FROM committee_members WHERE professor_id = ?`,
            [req.user.id]
        );

        res.json({
            avg_completion_days: {
                supervised: supervised[0].avg_days || 0,
                committee: committee[0].avg_days || 0
            },
            avg_grade: {
                supervised: avg_grade_supervised[0].avg_grade || 0,
                committee: avg_grade_committee[0].avg_grade || 0
            },
            total_theses: {
                supervised: count_supervised[0].total || 0,
                committee: count_committee[0].total || 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});




// 6) Διαχείριση διπλωματικών εργασιών
// Υπό Ανάθεση: Δες μέλη τριμελούς και απαντήσεις
router.get('/theses/:id/committee-invitations', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT ci.*, u.name, u.surname
             FROM committee_invitations ci
             JOIN users u ON ci.invited_professor_id = u.id
             WHERE ci.thesis_id = ?`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Υπό Ανάθεση: Ακύρωση ανάθεσης από επιβλέποντα
router.post('/theses/:id/cancel-assignment', async (req, res) => {
    try {
        // Διαγραφή προσκλήσεων και αναθέσεων τριμελούς
        await db.pool.query('DELETE FROM committee_invitations WHERE thesis_id = ?', [req.params.id]);
        await db.pool.query('DELETE FROM committee_members WHERE thesis_id = ?', [req.params.id]);
        // Επαναφορά thesis
        await db.pool.query(
            'UPDATE thesis SET student_id = 0, status = "under_assignment", cancellation_reason = "Ακύρωση από Διδάσκοντα" WHERE id = ? AND supervisor_id = ?',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Assignment cancelled and related records deleted.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Ενεργή: Καταχώρηση σημείωσης (μέχρι 300 χαρακτήρες)
router.post('/theses/:id/note', async (req, res) => {
    const { note } = req.body;
    if (!note || note.length > 300) {
        return res.status(400).json({ error: 'Note must be up to 300 characters.' });
    }
    try {
        await db.pool.query(
            'INSERT INTO progress_notes (thesis_id, author_id, note) VALUES (?, ?, ?)',
            [req.params.id, req.user.id, note]
        );
        res.json({ message: 'Note added.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Ενεργή: Ακύρωση ανάθεσης μετά από 2 έτη (μόνο από επιβλέποντα)
router.post('/theses/:id/cancel-active', async (req, res) => {
    const { gs_protocol, gs_year } = req.body;
    try {
        // Έλεγχος αν έχουν περάσει 2 έτη
        const [rows] = await db.pool.query(
            'SELECT assignment_date FROM thesis WHERE id = ? AND supervisor_id = ? AND status = "active"',
            [req.params.id, req.user.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Thesis not found or not active.' });
        const assignmentDate = new Date(rows[0].assignment_date);
        const now = new Date();
        if ((now - assignmentDate) < 2 * 365 * 24 * 60 * 60 * 1000) {
            return res.status(400).json({ error: 'Cannot cancel before 2 years.' });
        }
        await db.pool.query(
            'UPDATE thesis SET status = "cancelled", cancellation_reason = "Ακύρωση από Διδάσκοντα", gs_approval_protocol = ?, assignment_date = ?, presentation_date = NULL WHERE id = ?',
            [`${gs_protocol}/${gs_year}`, now, req.params.id]
        );
        res.json({ message: 'Thesis assignment cancelled.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Ενεργή: Αλλαγή κατάστασης σε "Υπό Εξέταση" (μόνο από επιβλέποντα)
router.post('/theses/:id/set-under-review', async (req, res) => {
    try {
        await db.pool.query(
            'UPDATE thesis SET status = "under_review" WHERE id = ? AND supervisor_id = ? AND status = "active"',
            [req.params.id, req.user.id]
        );
        res.json({ message: 'Thesis status set to under review.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Υπό Εξέταση: Δες (πρόχειρο) κείμενο διπλωματικής
router.get('/theses/:id/draft', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT * FROM thesis_files WHERE thesis_id = ? AND file_type = 'draft' ORDER BY uploaded_at DESC LIMIT 1`,
            [req.params.id]
        );
        res.json(rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Υπό Εξέταση: Προβολή ανακοίνωσης παρουσίασης (μόνο αν υπάρχουν στοιχεία παρουσίασης)
router.get('/theses/:id/presentation-announcement', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT presentation_date, presentation_location FROM thesis WHERE id = ?`,
            [req.params.id]
        );
        if (!rows.length || !rows[0].presentation_date || !rows[0].presentation_location) {
            return res.status(400).json({ error: 'Presentation details not completed.' });
        }
        // Παράδειγμα ανακοίνωσης
        const announcement = `Η παρουσίαση της διπλωματικής θα γίνει στις ${rows[0].presentation_date} στην αίθουσα ${rows[0].presentation_location}.`;
        res.json({ announcement });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Υπό Εξέταση: Ενεργοποίηση και καταχώρηση βαθμού (επιβλέπων ή μέλος)
router.post('/theses/:id/grade', async (req, res) => {
    const { grade, grade_details } = req.body;
    if (grade < 0 || grade > 10) {
        return res.status(400).json({ error: 'Grade must be between 0 and 10.' });
    }
    try {
        // Έλεγχος ρόλου
        const [isSupervisor] = await db.pool.query(
            'SELECT supervisor_id FROM thesis WHERE id = ?',
            [req.params.id]
        );
        if (isSupervisor.length && isSupervisor[0].supervisor_id === req.user.id) {
            // Επιβλέπων: ενημέρωση thesis και committee_members
            await db.pool.query(
                'UPDATE thesis SET grade = ? WHERE id = ?',
                [grade, req.params.id]
            );
            await db.pool.query(
                'UPDATE committee_members SET grade = ?, grade_details = ? WHERE thesis_id = ? AND professor_id = ? AND role = "supervisor"',
                [grade, grade_details, req.params.id, req.user.id]
            );
        } else {
            // Μέλος τριμελούς: ενημέρωση μόνο committee_members
            await db.pool.query(
                'UPDATE committee_members SET grade = ?, grade_details = ? WHERE thesis_id = ? AND professor_id = ? AND role = "member"',
                [grade, grade_details, req.params.id, req.user.id]
            );
        }
        res.json({ message: 'Grade submitted.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Υπό Εξέταση: Δες βαθμούς όλων των μελών τριμελούς
router.get('/theses/:id/grades', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            `SELECT cm.professor_id, u.name, u.surname, cm.role, cm.grade, cm.grade_details
             FROM committee_members cm
             JOIN users u ON cm.professor_id = u.id
             WHERE cm.thesis_id = ?`,
            [req.params.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});