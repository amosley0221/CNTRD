const express = require('express');
const path = require('path');
const cors = require('cors');

const uploadRouter = require('./routes/upload');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadRouter.uploadDir));

// API Routes
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/users',  require('./routes/users'));
app.use('/api/posts',  require('./routes/posts'));
app.use('/api/plays',  require('./routes/plays'));
app.use('/api/games',  require('./routes/games'));
app.use('/api/teams',  require('./routes/teams'));
app.use('/api/pages',  require('./routes/pages'));
app.use('/api/admin',  require('./routes/admin'));
app.use('/api/static', require('./routes/static'));
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', app: 'CNTRD' }));

// SPA fallback – serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CNTRD running at http://localhost:${PORT}`);
});
