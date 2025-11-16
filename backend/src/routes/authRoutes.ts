import express from 'express';
import {
  login,
  getCurrentUser,
  updateProfile,
  updatePassword,
  createCustomer,
} from '../controllers/authController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 公开路由
router.post('/login', login);

// 需要认证的路由
router.get('/me', authenticateToken, getCurrentUser);

// 用户个人中心路由
router.put('/profile', authenticateToken, updateProfile);
router.put('/profile/password', authenticateToken, updatePassword);

// 需要管理员权限的路由
router.post('/customers', authenticateToken, requireAdmin, createCustomer);

export default router;

