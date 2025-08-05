const express = require('express');
const router = express.Router();
const db = require('../db');

// Επιστρέφει όλες τις εργασίες σε κατάσταση "active" ή "under_review" με τα ζητούμενα δεδομένα
router.get('/active_and_review', async (req, res) => {
    try {
        const [theses] = await db.pool.query(
            `SELECT id, title, description, status, assignment_date
             FROM thesis
             WHERE status IN ('active', 'under_review')`
        );

        // Για κάθε εργασία, βρες τα μέλη της επιτροπής και υπολόγισε τις μέρες από την ανάθεση
        const results = await Promise.all(theses.map(async (thesis) => {
            // Βρες τα μέλη της τριμελούς επιτροπής
            const [members] = await db.pool.query(
                `SELECT u.id, u.name, u.surname, cm.role
                 FROM committee_members cm
                 JOIN users u ON cm.professor_id = u.id
                 WHERE cm.thesis_id = ?`,
                [thesis.id]
            );

            // Υπολογισμός ημερών από την ανάθεση
            let days_since_assignment = null;
            if (thesis.assignment_date) {
                const [daysRow] = await db.pool.query(
                    `SELECT DATEDIFF(NOW(), ?) AS days`, [thesis.assignment_date]
                );
                days_since_assignment = daysRow[0].days;
            }

            return {
                id: thesis.id,
                title: thesis.title,
                description: thesis.description,
                status: thesis.status,
                committee_members: members,
                days_since_assignment
            };
        }));

        res.json(results);
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Εισαγωγή χρηστών από JSON
router.post('/import_users', async (req, res) => {
    try {
        const users = req.body.users;
        if (!Array.isArray(users) || users.length === 0) {
            return res.status(400).json({ error: 'Το JSON πρέπει να περιέχει array με χρήστες στο πεδίο "users".' });
        }

        for (const user of users) {
            const {
                name,
                surname,
                email,
                password,
                topic,
                landline,
                mobile,
                street,
                street_number,
                city,
                postal_code,
                country,
                department,
                university,
                role
            } = user;

            await db.pool.query(
                `INSERT INTO users 
                (name, surname, email, password, topic, landline, mobile, street, street_number, city, postal_code, country, department, university, role)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [name, surname, email, password, topic, landline, mobile, street, street_number, city, postal_code, country, department, university, role]
            );
        }

        res.json({ message: 'Η εισαγωγή χρηστών ολοκληρώθηκε επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Ενημέρωση ΑΠ ΓΣ (gs_approval_protocol) για ανάθεση ή πρακτικό εξέτασης
router.put('/update_gs_protocol', async (req, res) => {
    try {
        const { thesis_id, gs_approval_protocol } = req.body;

        // Ενημέρωση του πεδίου gs_approval_protocol στην εργασία
        await db.pool.query(
            `UPDATE thesis 
             SET gs_approval_protocol = ?
             WHERE id = ?`,
            [gs_approval_protocol, thesis_id]
        );

        res.json({ message: 'Ο ΑΠ ΓΣ ενημερώθηκε επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Ακύρωση ανάθεσης εργασίας από τη γραμματεία
router.put('/cancel_assignment', async (req, res) => {
    try {
        const { thesis_id, gs_cancellation_protocol, cancellation_reason } = req.body;

        // Ενημέρωση της εργασίας με ακύρωση
        await db.pool.query(
            `UPDATE thesis 
             SET status = 'cancelled',
                 gs_approval_protocol = ?,
                 cancellation_reason = ?
             WHERE id = ?`,
            [gs_cancellation_protocol, cancellation_reason, thesis_id]
        );

        res.json({ message: 'Η ανάθεση ακυρώθηκε επιτυχώς.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});

// Η γραμματεία αλλάζει την κατάσταση της ΔΕ σε "completed" (Περατωμένη)
router.put('/complete_thesis', async (req, res) => {
    try {
        const { thesis_id } = req.body;

        // Έλεγχος αν υπάρχει βαθμός και σύνδεσμος repository
        const [rows] = await db.pool.query(
            `SELECT grade, repository_url FROM thesis WHERE id = ?`,
            [thesis_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Δεν βρέθηκε η εργασία.' });
        }
        const thesis = rows[0];
        if (thesis.grade === null || !thesis.repository_url) {
            return res.status(400).json({ error: 'Απαιτείται καταχώρηση βαθμού και συνδέσμου Νημερτή πριν την περάτωση.' });
        }

        await db.pool.query(
            `UPDATE thesis SET status = 'completed' WHERE id = ?`,
            [thesis_id]
        );

        res.json({ message: 'Η κατάσταση της ΔΕ άλλαξε σε Περατωμένη.' });
    } catch (err) {
        res.status(500).json({ error: 'Database error', details: err.message });
    }
});


module.exports = router; 