import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/org.routes';
import inviteRoutes from './routes/invite.routes';
import formRoutes from './routes/form.routes';
import templateRoutes from './routes/template.routes';
import submissionRoutes from './routes/submission.routes';
import paymentRoutes from './routes/payment.routes';
import draftRoutes from './routes/draft.routes';
import processingRoutes from './routes/processing.routes';
import dmsRoutes from './routes/dms.routes';

import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 12001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:12000',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Apply rate limit specifically to submissions
app.use('/api/submissions', limiter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/orgs', orgRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/forms', formRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/drafts', draftRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/dms', dmsRoutes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
