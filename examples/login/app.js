'use strict';
const express = require('express');
const session = require('express-session');
const { Passport } = require('passport');
const { randomBytes } = require('node:crypto');
const { Strategy } = require('passport-yandex');

function createApp(config = {}) {
  const clientID = config.clientID || process.env.YANDEX_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.YANDEX_CLIENT_SECRET;
  const sessionSecret = config.sessionSecret || process.env.SESSION_SECRET;
  const callbackURL = config.callbackURL || process.env.YANDEX_CALLBACK_URL || 'http://127.0.0.1:3000/auth/yandex/callback';
  if (!clientID || !clientSecret || !sessionSecret) {
    throw new Error('Set YANDEX_CLIENT_ID, YANDEX_CLIENT_SECRET and SESSION_SECRET');
  }
  const app = express();
  const passport = new Passport();
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.disable('x-powered-by');
  app.use(express.urlencoded({ extended: false }));
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    store: config.sessionStore,
    cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
  }));
  app.use(passport.initialize());
  app.use(passport.session());
  // Demo only: store a small presentation object. Real apps serialize a local
  // user ID and load the account from their database in deserializeUser.
  passport.serializeUser((user, done) => done(null, { id: user.id, displayName: user.displayName }));
  passport.deserializeUser((user, done) => done(null, user));
  passport.use(new Strategy({ clientID, clientSecret, callbackURL, scope: ['login:info'], state: true, pkce: 'S256' },
    (accessToken, refreshToken, profile, done) => done(null, profile)));
  app.use((req, res, next) => {
    if (!req.session.csrfToken) req.session.csrfToken = randomBytes(32).toString('hex');
    res.locals.user = req.user;
    res.locals.csrfToken = req.session.csrfToken;
    next();
  });
  app.get('/', (req, res) => res.render('index'));
  app.get('/login', (req, res) => res.render('login'));
  app.get('/account', (req, res) => {
    if (!req.isAuthenticated()) return res.redirect('/login');
    res.render('account');
  });
  app.get('/auth/yandex', passport.authenticate('yandex'));
  app.get('/auth/yandex/callback', passport.authenticate('yandex', { failureRedirect: '/login' }), (req, res) => res.redirect('/account'));
  app.post('/logout', (req, res, next) => {
    if (!req.body.csrfToken || req.body.csrfToken !== req.session.csrfToken) return res.sendStatus(403);
    req.logout(err => err ? next(err) : res.redirect('/'));
  });
  app.use((err, req, res, next) => {
    // Do not log OAuth response bodies or tokens in this example.
    res.status(500).send('Authentication failed. Please try again.');
  });
  return app;
}

module.exports = { createApp };
if (require.main === module) {
  createApp().listen(3000, '127.0.0.1', () => console.log('Open http://127.0.0.1:3000'));
}
