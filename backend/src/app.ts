import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import reminderRoutes from './routes/reminderRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import userRoutes from './routes/userRoutes.js';
import configRoutes from './routes/configRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import followUpRoutes from './routes/followUpRoutes.js';
import orderNumberFeedbackRoutes from './routes/orderNumberFeedbackRoutes.js';
import { errorHandler, notFoundHandler } from './errors/errorHandler.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: '跟单系统API运行正常' });
  });

  app.use('/uploads', express.static('uploads'));

  app.use('/api/auth', authRoutes);
  app.use('/api/orders', orderRoutes);
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/configs', configRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/follow-ups', followUpRoutes);
  app.use('/api/order-feedbacks', orderNumberFeedbackRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp();
export default app;


