require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const errorMiddleware = require('./middleware/error');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const analysisRoutes = require('./routes/analysis.routes');
const questionRoutes = require('./routes/question.routes');
const memoRoutes = require('./routes/memo.routes');
const adminRoutes = require('./routes/admin.routes');
const personaRoutes = require('./routes/persona.routes');

const app = express();

app.use(cors({
    origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

// Serve uploaded files (decks, sheets) under /files/...
app.use('/files', express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/analyses', analysisRoutes);
app.use('/api/analyses', questionRoutes);     // mounts /:id/questions
app.use('/api/analyses', memoRoutes);         // mounts /:id/memo
app.use('/api/admin',           adminRoutes);                  // admin panel
app.use('/api/admin/personas',  personaRoutes.adminRouter);    // SAMAJ admin
app.use('/api/invites',         personaRoutes.publicRouter);   // SAMAJ public intake

app.use((req, res) => res.status(404).json({ error: 'Not found', path: req.originalUrl }));
app.use(errorMiddleware);

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
    console.log(`[windikate-api] listening on :${PORT}`);
});
