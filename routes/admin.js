// routes/admin.js
const express = require("express");
const router = express.Router();
const db = require("../config/db");
const { requireLogin } = require("../utils/auth");

// Redirect /admin ke dashboard admin
router.get('/', (req, res) => {
  res.redirect('/admin/dashboard-admin');
});

// Wajib login admin
router.use(requireLogin("admin"));

/* ============================================================
   DASHBOARD
   ============================================================ */

// Debug JSON (opsional)
router.get("/debug-counts", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM \`user\`) AS totalUsers,
        (SELECT COUNT(*) FROM penyakit) AS totalPenyakit,
        (SELECT COUNT(*) FROM gejala) AS totalGejala
    `);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Halaman dashboard utama
async function renderDashboard(req, res) {
  try {
    const [rows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM \`user\`) AS totalUsers,
        (SELECT COUNT(*) FROM penyakit) AS totalPenyakit,
        (SELECT COUNT(*) FROM gejala) AS totalGejala
    `);

    const c = rows[0];

    res.render("admin/dashboard_admin", {
      user: req.session.user,
      totalUsers: Number(c.totalUsers),
      totalPenyakit: Number(c.totalPenyakit),
      totalGejala: Number(c.totalGejala),
      msg: null
    });

  } catch (e) {
    res.render("admin/dashboard_admin", {
      user: req.session.user,
      totalUsers: 0,
      totalPenyakit: 0,
      totalGejala: 0,
      msg: "Gagal mengambil statistik"
    });
  }
}

router.get("/dashboard-admin", renderDashboard);

// Daftar User
router.get('/user', (req, res) => {
  res.render('admin/daftar_user', {
    user: req.session.user,
    title: 'Daftar User'
  });
});

// Daftar Penyakit
router.get('/penyakit', (req, res) => {
  res.render('admin/daftar_penyakit', {
    user: req.session.user,
    title: 'Daftar Penyakit'
  });
});

// Daftar Gejala
router.get('/gejala', (req, res) => {
  res.render('admin/daftar_gejala', {
    user: req.session.user,
    title: 'Daftar Gejala'
  });
});

// Kelola Relasi
router.get('/relasi', (req, res) => {
  res.render('admin/kelola_relasi', {
    user: req.session.user,
    title: 'Kelola Relasi'
  });
});

/* ============================================================
   USER CRUD (JSON)
   ============================================================ */

// List User
// LIST user (dengan search)
router.get('/user/list', async (req, res) => {
  try {
    const search = req.query.q || '';

    const [rows] = await db.query(`
      SELECT 
        id_user AS id,
        nama,
        username,
        role
      FROM user
      WHERE nama LIKE ? OR username LIKE ?
      ORDER BY nama
    `, [`%${search}%`, `%${search}%`]);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error(err);
    res.json({ success: false, message: err.message });
  }
});

// Edit User
router.put('/user/update/:id', async (req, res) => {
  try {
    const { role } = req.body;
    const id = req.params.id;

    if (!['admin', 'user'].includes(role)) {
      return res.json({ success: false, message: 'Role tidak valid' });
    }

    // Cegah admin terakhir diubah jadi user
    const [[adminCount]] = await db.query(
      'SELECT COUNT(*) AS total FROM user WHERE role = "admin"'
    );

    const [[current]] = await db.query(
      'SELECT role FROM user WHERE id_user = ? LIMIT 1',
      [id]
    );

    if (
      current.role === 'admin' &&
      role === 'user' &&
      adminCount.total <= 1
    ) {
      return res.json({
        success: false,
        message: 'Minimal harus ada 1 admin'
      });
    }

    await db.query(
      'UPDATE user SET role = ? WHERE id_user = ?',
      [role, id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ success: false, message: 'Gagal update user' });
  }
});

// Hapus User
router.delete('/user/delete/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // Cegah hapus admin
    const [[userRow]] = await db.query(
      'SELECT role FROM user WHERE id_user = ? LIMIT 1',
      [id]
    );

    if (!userRow) {
      return res.json({ success: false, message: 'User tidak ditemukan' });
    }

    if (userRow.role === 'admin') {
      return res.json({
        success: false,
        message: 'User admin tidak boleh dihapus'
      });
    }

    await db.query('DELETE FROM user WHERE id_user = ?', [id]);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ success: false, message: 'Gagal hapus user' });
  }
});

/* ============================================================
   PENYAKIT CRUD (JSON)
   ============================================================ */

// List penyakit
router.get("/penyakit/list", async (req, res) => {
  try {
    const search = req.query.q || "";
    const [rows] = await db.query(
      `SELECT 
        id_penyakit AS id,
        id_penyakit AS kode,
        nama_penyakit AS nama,
        deskripsi,
        solusi
       FROM penyakit
       WHERE nama_penyakit LIKE ?
       ORDER BY id_penyakit`,
      [`%${search}%`]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Tambah penyakit
router.post("/penyakit/create", async (req, res) => {
  try {
    const { kode, nama, deskripsi, solusi } = req.body;

    await db.query(
      `INSERT INTO penyakit 
       (id_penyakit, nama_penyakit, deskripsi, solusi)
       VALUES (?, ?, ?, ?)`,
      [kode, nama, deskripsi, solusi]
    );

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Edit penyakit
router.put("/penyakit/update/:id", async (req, res) => {
  try {
    const { kode, nama, deskripsi, solusi } = req.body;

    await db.query(
      `UPDATE penyakit 
       SET id_penyakit=?, nama_penyakit=?, deskripsi=?, solusi=?
       WHERE id_penyakit=?`,
      [kode, nama, deskripsi, solusi, req.params.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Hapus penyakit
router.delete("/penyakit/delete/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM penyakit WHERE id_penyakit=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/* ============================================================
   GEJALA CRUD (JSON)
   ============================================================ */

router.get("/gejala/list", async (req, res) => {
  try {
    const search = req.query.q || "";

    const [rows] = await db.query(
      `SELECT 
        id_gejala AS id,
        id_gejala AS kode,
        nama_gejala AS nama
       FROM gejala
       WHERE nama_gejala LIKE ?
       ORDER BY id_gejala`,
      [`%${search}%`]
    );

    res.json({ success: true, data: rows });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post("/gejala/create", async (req, res) => {
  try {
    const { kode, nama } = req.body;

    await db.query(
      "INSERT INTO gejala (id_gejala, nama_gejala) VALUES (?, ?)",
      [kode, nama]
    );

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.put("/gejala/update/:id", async (req, res) => {
  try {
    const { kode, nama } = req.body;

    await db.query(
      "UPDATE gejala SET id_gejala=?, nama_gejala=? WHERE id_gejala=?",
      [kode, nama, req.params.id]
    );

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.delete("/gejala/delete/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM gejala WHERE id_gejala=?", [req.params.id]);
    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

/* ============================================================
   RELASI CRUD (JSON)
   ============================================================ */

// List relasi
router.get("/relasi/list", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        r.id_relasi AS id,
        r.id_penyakit AS penyakit_id,
        p.nama_penyakit AS penyakit_nama,
        r.id_gejala AS gejala_id,
        g.nama_gejala AS gejala_nama,
        r.mb,
        r.md,
        r.bobot
      FROM relasi r
      JOIN penyakit p ON r.id_penyakit = p.id_penyakit
      JOIN gejala g ON r.id_gejala = g.id_gejala
      ORDER BY r.id_relasi
    `);

    res.json({ success: true, data: rows });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Tambah relasi
router.post("/relasi/create", async (req, res) => {
  try {
    const { penyakit_id, gejala_id, mb, md } = req.body;

    const bobot = parseFloat(mb) - parseFloat(md);

    await db.query(
      "INSERT INTO relasi (id_penyakit, id_gejala, mb, md, bobot) VALUES (?, ?, ?, ?, ?)",
      [penyakit_id, gejala_id, mb, md, bobot]
    );

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Edit relasi
router.put("/relasi/update/:id", async (req, res) => {
  try {
    const { penyakit_id, gejala_id, mb, md } = req.body;

    const bobot = parseFloat(mb) - parseFloat(md);

    await db.query(
      "UPDATE relasi SET id_penyakit=?, id_gejala=?, mb=?, md=?, bobot=? WHERE id_relasi=?",
      [penyakit_id, gejala_id, mb, md, bobot, req.params.id]
    );

    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// Hapus relasi
router.delete("/relasi/delete/:id", async (req, res) => {
  try {
    await db.query("DELETE FROM relasi WHERE id_relasi=?", [req.params.id]);
    res.json({ success: true });

  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;
