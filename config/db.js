const mysql = require('mysql2');

// SESUAIKAN dengan pengaturan XAMPP kamu
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',          // default XAMPP
  password: '',          // kalau pakai password, isi di sini
  database: 'db_stroke_pakar'  // nama DB yang sudah kamu buat
});

// optional: test koneksi saat start
pool.getConnection((err, conn) => {
  if (err) {
    console.error('Gagal konek ke database:', err.message);
  } else {
    console.log('Berhasil konek ke database MySQL');
    conn.release();
  }
});

module.exports = pool.promise(); // pakai versi promise biar enak dipakai async/await
