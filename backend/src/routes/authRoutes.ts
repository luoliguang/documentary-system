import express from 'express';
import {
  login,
  getCurrentUser,
  updateProfile,
  updatePassword,
  createCustomer,
} from '../controllers/authController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  loginSchema,
  changePasswordSchema,
} from '../validators/authSchemas.js';
import { createUserSchema } from '../validators/userSchemas.js';

const router = express.Router();

// 公开路由
router.post('/login', validateBody(loginSchema), login);

// 需要认证的路由
router.get('/me', authenticateToken, getCurrentUser);

// 用户个人中心路由
router.put('/profile', authenticateToken, updateProfile);
router.put('/profile/password', authenticateToken, validateBody(changePasswordSchema), updatePassword);

// 需要管理员权限的路由
router.post('/customers', authenticateToken, requireAdmin, validateBody(createUserSchema), createCustomer);

export default router;

