// utils/auth.js
function requireLogin(role) {
  return (req, res, next) => {
    if (!req.session.user) {
      if (role === 'admin') return res.redirect('/login-admin');
      return res.redirect('/');
    }
    if (role && req.session.user.role !== role) {
      return res.status(403).send('Anda tidak memiliki hak akses.');
    }
    next();
  };
}
module.exports = { requireLogin };
