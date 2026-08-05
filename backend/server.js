require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const chatbotRoutes = require('./routes/chatbot');
const quizRoutes = require('./routes/quiz');
const adminRoutes = require('./routes/admin');
const scheduleRoutes = require('./routes/schedule');
const { ensureCsrfCookie, requireCsrf } = require('./middleware/csrf');
const { generalLimiter } = require('./middleware/rateLimit');

const requiredEnvVars = ['ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET', 'MONGODB_URI'];
for (const key of requiredEnvVars) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(ensureCsrfCookie);
app.use('/api', generalLimiter);
app.use('/api', requireCsrf);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/csrf', (req, res) => res.json({ csrfToken: req.cookies.ec_csrf }));

app.use('/api/auth', authRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/schedule', scheduleRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    message: err.expose ? err.message : 'Unexpected server error',
    ...(isProd ? {} : { error: err.message }),
  });
});

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    app.listen(PORT, () => console.log(`EduConnect API listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
