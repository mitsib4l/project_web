const express = require('express');
const router = express.Router();
const db = require('../db');

// Επιστρέφει όλους τους φοιτητές
router.get('/', async (req, res) => {
    try {
        const [rows] = await db.pool.query('SELECT * FROM students');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Επιστρέφει το θέμα που έχει ανατεθεί στον logged in φοιτητή και τον αριθμό ημερών από την ανάθεση
router.get('/student_thesis', async (req, res) => {
    try {
        const studentId = req.user.id;
        const [rows] = await db.pool.query(
            `SELECT *, 
                DATEDIFF(NOW(), assignment_date) AS days_since_assignment 
             FROM thesis 
             WHERE student_id = ?`,
            [studentId]
        );
        if (rows.length === 0) {
            return res.json({ message: 'Δεν σας έχει ανατεθεί κάποιο θέμα.' });
        }
        const thesis = rows[0];
        res.json({
            thesis,
            days_since_assignment: thesis.days_since_assignment
        });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Επεξεργασία προφίλ φοιτητή (update στοιχεία επικοινωνίας)
router.put('/profile', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { street, street_number, city, postal_code, email, mobile, landline } = req.body;
        await db.pool.query(
            `UPDATE users 
             SET street = ?, street_number = ?, city = ?, postal_code = ?, email = ?, mobile = ?, landline = ?
             WHERE id = ? AND role = 'student'`,
            [street, street_number, city, postal_code, email, mobile, landline, studentId]
        );
        res.json({ message: 'Τα στοιχεία επικοινωνίας ενημερώθηκαν επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Λίστα καθηγητών που μπορεί να προσκαλέσει ο φοιτητής
router.get('/professor_list', async (req, res) => {
    try {
        const [rows] = await db.pool.query(
            "SELECT name, surname, topic, email, mobile, landline, department, university FROM users WHERE role = 'professor'"
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Ανέβασμα αρχείου εργασίας από τον φοιτητή
router.post('/upload_thesis_file', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { thesis_id, file_type, file_url_or_path, description } = req.body;

        // Έλεγχος αν το thesis ανήκει στον φοιτητή
        const [thesisRows] = await db.pool.query(
            'SELECT id FROM thesis WHERE id = ? AND student_id = ?',
            [thesis_id, studentId]
        );
        if (thesisRows.length === 0) {
            return res.status(403).json({ error: 'Δεν έχετε δικαίωμα να ανεβάσετε αρχείο σε αυτή την εργασία.' });
        }

        await db.pool.query(
            `INSERT INTO thesis_files (thesis_id, uploader_id, file_type, file_url_or_path, description)
             VALUES (?, ?, ?, ?, ?)`,
            [thesis_id, studentId, file_type, file_url_or_path, description]
        );
        res.status(201).json({ message: 'Το αρχείο καταχωρήθηκε επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Ενημέρωση στοιχείων εξέτασης/παρουσίασης της εργασίας του φοιτητή
router.put('/set_presentation', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { thesis_id, presentation_date, presentation_location } = req.body;

        // Έλεγχος αν το thesis ανήκει στον φοιτητή
        const [thesisRows] = await db.pool.query(
            'SELECT id FROM thesis WHERE id = ? AND student_id = ?',
            [thesis_id, studentId]
        );
        if (thesisRows.length === 0) {
            return res.status(403).json({ error: 'Δεν έχετε δικαίωμα να ενημερώσετε αυτή την εργασία.' });
        }

        await db.pool.query(
            `UPDATE thesis 
             SET presentation_date = ?, presentation_location = ?
             WHERE id = ?`,
            [presentation_date, presentation_location, thesis_id]
        );
        res.json({ message: 'Τα στοιχεία εξέτασης/παρουσίασης ενημερώθηκαν επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Επιστρέφει το πρακτικό εξέτασης της εργασίας του φοιτητή
router.get('/examination_report', async (req, res) => {
    try {
        const studentId = req.user.id;
        // Βρες την εργασία του φοιτητή
        const [rows] = await db.pool.query(
            `SELECT t.id, t.title, t.grade, t.gs_approval_protocol, t.presentation_date, t.presentation_location,
                    t.repository_url, t.status,
                    (SELECT GROUP_CONCAT(CONCAT(u.name, ' ', u.surname, ' (', cm.role, ')') SEPARATOR ', ')
                     FROM committee_members cm
                     JOIN users u ON cm.professor_id = u.id
                     WHERE cm.thesis_id = t.id) AS committee
             FROM thesis t
             WHERE t.student_id = ?`,
            [studentId]
        );
        if (rows.length === 0) {
            return res.status(404).send('Δεν βρέθηκε εργασία για τον φοιτητή.');
        }
        const thesis = rows[0];

        // Δημιουργία HTML πρακτικού εξέτασης
        const html = `
            <html>
            <head><title>Πρακτικό Εξέτασης</title></head>
            <body>
                <h2>Πρακτικό Εξέτασης Διπλωματικής Εργασίας</h2>
                <p><strong>Θέμα:</strong> ${thesis.title}</p>
                <p><strong>Βαθμός:</strong> ${thesis.grade ?? 'Δεν έχει καταχωρηθεί'}</p>
                <p><strong>ΑΠ ΓΣ:</strong> ${thesis.gs_approval_protocol ?? '-'}</p>
                <p><strong>Ημερομηνία Παρουσίασης:</strong> ${thesis.presentation_date ?? '-'}</p>
                <p><strong>Τοποθεσία/Σύνδεσμος:</strong> ${thesis.presentation_location ?? '-'}</p>
                <p><strong>Τριμελής Επιτροπή:</strong> ${thesis.committee ?? '-'}</p>
                <p><strong>Σύνδεσμος Νημερτής:</strong> ${thesis.repository_url ?? 'Δεν έχει καταχωρηθεί'}</p>
                <p><strong>Κατάσταση:</strong> ${thesis.status}</p>
            </body>
            </html>
        `;
        res.send(html);
    } catch (err) {
        res.status(500).send('Database error');
    }
});

// Ο φοιτητής καταχωρεί το σύνδεσμο Νημερτή για την εργασία του
router.put('/repository_url', async (req, res) => {
    try {
        const studentId = req.user.id;
        const { repository_url } = req.body;
        // Ενημέρωση του πεδίου repository_url στην εργασία του φοιτητή
        await db.pool.query(
            `UPDATE thesis SET repository_url = ? WHERE student_id = ?`,
            [repository_url, studentId]
        );
        res.json({ message: 'Ο σύνδεσμος Νημερτής καταχωρήθηκε επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

module.exports = router;