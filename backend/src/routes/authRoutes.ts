import express from 'express';
import {
  login,
  getCurrentUser,
  createCustomer,
} from '../controllers/authController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 公开路由
router.post('/login', login);

// 需要认证的路由
router.get('/me', authenticateToken, getCurrentUser);

// 需要管理员权限的路由
router.post('/customers', authenticateToken, requireAdmin, createCustomer);

export default router;

