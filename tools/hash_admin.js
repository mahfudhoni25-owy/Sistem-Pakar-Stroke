// tools/hash_admin.js
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function run() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',        // ganti sesuai config Anda
    password: '',        // ganti sesuai config Anda
    database: 'db_stroke_pakar' // ganti sesuai nama DB Anda
  });

  const username = 'admin';      // user admin yang ingin di-hash
  const plainPassword = 'admin123'; // ganti jadi password admin yang sekarang / yang Anda inginkan

  const hash = await bcrypt.hash(plainPassword, 10);

  const [res] = await conn.execute('UPDATE user SET password = ? WHERE username = ? AND role = "admin"', [hash, username]);
  console.log('Updated rows:', res.affectedRows);
  await conn.end();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
