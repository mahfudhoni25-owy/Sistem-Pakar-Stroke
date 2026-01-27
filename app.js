const express = require('express');
const path = require('path');
const session = require('express-session'); // <--- tambah ini


const app = express();
const indexRoutes = require('./routes/index');
const adminRoutes = require('./routes/admin');

// set view engine ke EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// middleware body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// middleware session
app.use(session({
  secret: 'rahasia_skripsi_stroke', // boleh diganti apa saja
  resave: false,
  saveUninitialized: false
}));

// routes
app.use(express.static(path.join(__dirname, 'public')));
// app.js (letakkan sebelum `app.use('/', indexRoutes);`)
app.use((req, res, next) => {
  res.locals.req = req;   // sekarang 'req' tersedia di semua EJS sebagai variable global
  next();
});

// Alias agar /dashboard-admin otomatis ke /admin/dashboard-admin
app.get('/dashboard-admin', (req, res) => {
  res.redirect('/admin/dashboard-admin');
});

app.use('/', indexRoutes);
app.use('/admin', adminRoutes);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
