// routes/index.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireLogin } = require('../utils/auth');
const bcrypt = require('bcryptjs');

/* -----------------------
   HELPER CF & LABEL
   ----------------------- */

// gabungkan dua CF
function combineTwoCF(cf1, cf2) {
  if (cf1 === null || cf1 === undefined) return cf2;
  if (cf2 === null || cf2 === undefined) return cf1;

  if ((cf1 >= 0 && cf2 >= 0) || (cf1 <= 0 && cf2 <= 0)) {
    return cf1 + cf2 * (1 - Math.abs(cf1));
  }

  const minAbs = Math.min(Math.abs(cf1), Math.abs(cf2));
  const denominator = 1 - minAbs;
  if (denominator === 0) return 0;
  return (cf1 + cf2) / denominator;
}

function combineCFList(cfList) {
  if (!cfList || cfList.length === 0) return 0;
  let combined = cfList[0];
  for (let i = 1; i < cfList.length; i++) {
    combined = combineTwoCF(combined, cfList[i]);
  }
  return combined;
}

// ubah CF (-1..1) ke persen & label
function cfToPercentAndLabel(cf) {
  const cfNum = Number(cf) || 0;
  const isNegative = cfNum < 0;
  const percent = Math.round(Math.abs(cfNum) * 10000) / 100; // dua desimal
  let label;
  if (percent >= 90) label = 'Sangat Tinggi';
  else if (percent >= 80) label = 'Tinggi';
  else if (percent >= 60) label = 'Cukup Tinggi';
  else if (percent >= 40) label = 'Cukup Rendah';
  else if (percent >= 20) label = 'Rendah';
  else label = 'Sangat Rendah';
  if (isNegative) label = `Negatif - ${label}`;
  return { cfPercent: percent, cfLabel: label };
}

/* -----------------------
   HOME / LOGIN / REGISTER
   ----------------------- */

// routes/index.js
router.get('/', (req, res) => {
  // Jika user sudah login, bisa redirect ke dashboard sesuai role (opsional)
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') return res.redirect('/dashboard-admin');
    if (req.session.user.role === 'user') return res.redirect('/dashboard-user');
  }

  // Render halaman beranda sebelum login
  res.render('index', {
    title: 'Sistem Pakar Stroke',
    message: 'Selamat datang di Sistem Pakar Deteksi Dini Penyakit Neurologis'
  });
});


// --- LOGIN USER (GET)
router.get('/login-user', (req, res) => {
  const msg = req.query.msg || null;
  res.render('login_user', { error: null, msg });
});

// --- LOGIN ADMIN (GET)
router.get('/login-admin', (req, res) => {
  res.render('login_admin', { error: null });
});

// --- REGISTER USER (GET)
router.get('/daftar', (req, res) => {
  res.render('register_user', { error: null, form: {} });
});

// --- PROSES REGISTER (POST)
router.post('/daftar', async (req, res) => {
  try {
    const { nama, username, password, password2 } = req.body;

    // Validasi sederhana
    if (!nama || !username || !password || !password2) {
      return res.render('register_user', { error: 'Semua field wajib diisi.', form: req.body });
    }
    if (password !== password2) {
      return res.render('register_user', { error: 'Password dan konfirmasi tidak cocok.', form: req.body });
    }
    if (password.length < 6) {
      return res.render('register_user', { error: 'Password minimal 6 karakter.', form: req.body });
    }

    // Cek username unik
    const [exists] = await db.query('SELECT id_user FROM user WHERE username = ? LIMIT 1', [username]);
    if (exists.length) {
      return res.render('register_user', { error: 'Username sudah digunakan. Gunakan username lain.', form: req.body });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Simpan user (role = 'user')
    await db.query('INSERT INTO user (nama, username, password, role) VALUES (?, ?, ?, ?)', [nama, username, hash, 'user']);

    // Redirect ke login dengan pesan sukses
    res.redirect('/login-user?msg=registered');

  } catch (err) {
    console.error('Error register:', err);
    let message = 'Terjadi kesalahan saat registrasi.';
    if (err && err.code === 'ER_DUP_ENTRY') message = 'Username sudah terdaftar.';
    res.render('register_user', { error: message, form: req.body || {} });
  }
});

// --- PROSES LOGIN USER (POST)
router.post('/login-user', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query('SELECT * FROM user WHERE username = ? AND role = "user" LIMIT 1', [username]);

    if (!rows.length) return res.render('login_user', { error: 'Username tidak ditemukan.', msg: null });
    const user = rows[0];

    // bandingkan hash
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login_user', { error: 'Password salah.', msg: null });

    // set session (simpan minimal info)
    req.session.user = {
      id_user: user.id_user,
      nama: user.nama,
      username: user.username,
      role: user.role
    };

    res.redirect('/dashboard-user');

  } catch (err) {
    console.error('Login user error:', err);
    res.render('login_user', { error: 'Terjadi kesalahan server.', msg: null });
  }
});

// --- PROSES LOGIN ADMIN (POST)
router.post('/login-admin', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await db.query('SELECT * FROM user WHERE username = ? AND role = "admin" LIMIT 1', [username]);

    if (!rows.length) return res.render('login_admin', { error: 'Username tidak ditemukan.' });
    const admin = rows[0];

    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.render('login_admin', { error: 'Password salah.' });

    req.session.user = {
      id_user: admin.id_user,
      nama: admin.nama,
      username: admin.username,
      role: admin.role
    };

    res.redirect('/dashboard-admin');

  } catch (err) {
    console.error('Login admin error:', err);
    res.render('login_admin', { error: 'Terjadi kesalahan server.' });
  }
});

/* -----------------------
   DASHBOARDS
   ----------------------- */

router.get('/dashboard-user', requireLogin('user'), (req, res) => {
  res.render('user/dashboard_user', { user: req.session.user });
});

router.get('/dashboard-admin', requireLogin('admin'), (req, res) => {
  res.render('admin/dashboard_admin', { user: req.session.user });
});

// Form diagnosa (GET /diagnosa) — proteksi login
router.get('/diagnosa', requireLogin('user'), async (req, res) => {
  try {
    const [gejala] = await db.query('SELECT * FROM gejala ORDER BY id_gejala');
    res.render('user/diagnosa_form', { gejala, req });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman diagnosa.');
  }
});

// Riwayat list (GET /riwayat) — proteksi login
router.get('/riwayat', requireLogin('user'), async (req, res) => {
  try {
    const idUser = req.session.user.id_user;
    const [rows] = await db.query(`
      SELECT dg.id_diagnosa, dg.tanggal, dg.id_penyakit, p.nama_penyakit, dg.nilai_cf
      FROM diagnosa dg
      JOIN riwayat_diagnosa rd ON rd.id_diagnosa = dg.id_diagnosa
      LEFT JOIN penyakit p ON dg.id_penyakit = p.id_penyakit
      WHERE dg.id_user = ?
      GROUP BY dg.id_diagnosa
      ORDER BY dg.tanggal DESC
    `, [idUser]);
    rows.forEach(r => { r.tanggal = new Date(r.tanggal).toLocaleString(); });
    res.render('user/riwayat', { riwayat: rows, req });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengambil riwayat diagnosa.');
  }
});

/* -----------------------
   DIAGNOSA (FORM & PROSES)
   ----------------------- */

// GET form diagnosa
router.get('/diagnosa', requireLogin('user'), async (req, res) => {
  try {
    const [gejala] = await db.query('SELECT * FROM gejala ORDER BY id_gejala');
    res.render('user/diagnosa_form', { gejala });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal memuat halaman diagnosa.');
  }
});

// POST proses diagnosa (FC + CF)
router.post('/diagnosa/proses', requireLogin('user'), async (req, res) => {
  try {
    let selected = req.body['gejala'];
    if (!selected) selected = [];
    if (!Array.isArray(selected)) selected = [selected];

    if (selected.length === 0) {
      const [gejala] = await db.query('SELECT * FROM gejala ORDER BY id_gejala');
      return res.render('user/diagnosa_form', { gejala, error: 'Pilih minimal 1 gejala.' });
    }

    const idUser = req.session.user.id_user;
    const placeholders = selected.map(_ => '?').join(',');

    // cari kandidat penyakit
    const [candidatesRows] = await db.query(
      `SELECT DISTINCT id_penyakit FROM relasi WHERE id_gejala IN (${placeholders})`,
      selected
    );

    if (!candidatesRows.length) {
      const [gejala] = await db.query('SELECT * FROM gejala ORDER BY id_gejala');
      return res.render('user/diagnosa_form', { gejala, error: 'Tidak ada penyakit yang cocok dengan kombinasi gejala tersebut.' });
    }

    const results = [];
    for (const row of candidatesRows) {
      const idPeny = row.id_penyakit;

    // ambil bobot CF dari tabel relasi
    const [relasiRows] = await db.query(
      `SELECT id_gejala, bobot 
      FROM relasi 
      WHERE id_penyakit = ? AND id_gejala IN (${placeholders})`,
      [idPeny, ...selected]
    );

    // bobot sudah = MB - MD
    const cfList = relasiRows.map(r => {
      return parseFloat((parseFloat(r.bobot) || 0).toFixed(4));
    });

      if (!cfList.length) continue;

      const cfFinal = combineCFList(cfList);
      results.push({ id_penyakit: idPeny, cfFinal, cfList });
    }

    if (results.length === 0) {
      const [gejala] = await db.query('SELECT * FROM gejala ORDER BY id_gejala');
      return res.render('user/diagnosa_form', { gejala, error: 'Belum ada bobot MB/MD untuk kombinasi gejala tersebut.' });
    }

    // pilih terbaik
    results.sort((a, b) => b.cfFinal - a.cfFinal);
    const best = results[0];

    // ambil info penyakit lengkap
    const [penyRows] = await db.query('SELECT nama_penyakit, deskripsi, solusi FROM penyakit WHERE id_penyakit = ? LIMIT 1', [best.id_penyakit]);
    const penyakitInfo = penyRows.length ? penyRows[0] : { nama_penyakit: best.id_penyakit, deskripsi: '-', solusi: '-' };

    // siapkan nilai untuk DB (number)
    const nilai_cf_db = parseFloat(best.cfFinal.toFixed(4));
    const { cfPercent, cfLabel } = cfToPercentAndLabel(nilai_cf_db);
    const keterangan = `CF: ${best.cfList.map(x => x.toFixed(4)).join(', ')} | ${cfLabel} (${cfPercent}%)`;

    // simpan diagnosa (nilai_cf sebagai number)
    const [insertRes] = await db.query(
      'INSERT INTO diagnosa (id_user, id_penyakit, nilai_cf, keterangan) VALUES (?, ?, ?, ?)',
      [idUser, best.id_penyakit, nilai_cf_db, keterangan]
    );
    const idDiagnosa = insertRes.insertId;

    // simpan riwayat gejala
    const insPromises = selected.map(gid => db.query('INSERT INTO riwayat_diagnosa (id_diagnosa, id_gejala) VALUES (?, ?)', [idDiagnosa, gid]));
    await Promise.all(insPromises);

    // redirect ke riwayat hasil
    res.redirect(`/riwayat/${idDiagnosa}`);

  } catch (err) {
    console.error('Error proses diagnosa:', err);
    res.status(500).send('Terjadi kesalahan saat memproses diagnosa.');
  }
});

/* -----------------------
   TENTANG WEBSITE
   ----------------------- */

// About page (Tentang Website)
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'Tentang Website',
    req
  });
});

/* -----------------------
   RIWAYAT (LIST & DETAIL)
   ----------------------- */

// list riwayat user
router.get('/riwayat', requireLogin('user'), async (req, res) => {
  try {
    const idUser = req.session.user.id_user;
    const [rows] = await db.query(`
      SELECT d.id_diagnosa, d.tanggal, d.id_penyakit, p.nama_penyakit, d.nilai_cf
      FROM diagnosa d
      LEFT JOIN penyakit p ON d.id_penyakit = p.id_penyakit
      WHERE d.id_user = ?
      ORDER BY d.tanggal DESC
    `, [idUser]);

    rows.forEach(r => { r.tanggal = new Date(r.tanggal).toLocaleString(); });
    res.render('user/riwayat', { riwayat: rows });
  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal mengambil riwayat diagnosa.');
  }
});

// detail riwayat
router.get('/riwayat/:id', requireLogin('user'), async (req, res) => {
  try {
    const idUser = req.session.user.id_user;
    const idDiagnosa = req.params.id;

    const [diag] = await db.query('SELECT * FROM diagnosa WHERE id_diagnosa = ? AND id_user = ? LIMIT 1', [idDiagnosa, idUser]);
    if (!diag.length) return res.status(404).send('Diagnosa tidak ditemukan.');

    const [details] = await db.query(`
      SELECT dd.id_riwayat, dd.id_gejala, g.nama_gejala
      FROM riwayat_diagnosa dd
      JOIN gejala g ON dd.id_gejala = g.id_gejala
      WHERE dd.id_diagnosa = ?
    `, [idDiagnosa]);

    const [peny] = await db.query('SELECT id_penyakit, nama_penyakit, deskripsi, solusi FROM penyakit WHERE id_penyakit = ? LIMIT 1', [diag[0].id_penyakit]);

    const hasil = {
      id_diagnosa: diag[0].id_diagnosa,
      tanggal: new Date(diag[0].tanggal).toLocaleString(),
      penyakit: peny.length ? peny[0] : { id_penyakit: diag[0].id_penyakit, nama_penyakit: '-', deskripsi: '-', solusi: '-' },
      nilai_cf: Number(diag[0].nilai_cf) || 0,
      keterangan: diag[0].keterangan || ''
    };

    const { cfPercent, cfLabel } = cfToPercentAndLabel(hasil.nilai_cf);
    res.render('user/hasil_diagnosa', { hasil, details, cfPercent, cfLabel });

  } catch (err) {
    console.error(err);
    res.status(500).send('Gagal menampilkan riwayat diagnosa.');
  }
});

/* -----------------------
   LOGOUT
   ----------------------- */

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

module.exports = router;
