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

import { startOutboxWorker } from './service/ums.outbox';
import { hasServiceCredentials } from './service/ums.client';
import { KEYCLOAK_ISSUER } from './config/ums.config';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 12001;

// The production Nginx proxy runs on the same host. Trust loopback by default
// (not arbitrary internet clients) so req.ip and express-rate-limit resolve the
// real client from X-Forwarded-For. Override for a known load-balancer CIDR.
app.set('trust proxy', process.env.TRUST_PROXY?.trim() || 'loopback');

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
  if (!KEYCLOAK_ISSUER) {
    console.error(
      'KEYCLOAK_ISSUER is not set. Every request will be rejected: the token issuer must ' +
        'come from configuration, never from the token being verified.'
    );
  }
  if (!hasServiceCredentials()) {
    console.warn(
      'UMS_SERVICE_USER_EMAIL / UMS_SERVICE_USER_PASSWORD are not set. Requests still work ' +
        '(the caller\'s own token is used), but background mirroring to the user-management ' +
        'service cannot run.'
    );
  }
  startOutboxWorker();
});

export default app;
