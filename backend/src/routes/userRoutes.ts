import express from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  toggleUserStatus,
} from '../controllers/userController.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

// 所有用户管理路由都需要管理员权限
router.use(authenticateToken);
router.use(requireAdmin);

// 获取用户列表
router.get('/', getUsers);

// 获取用户详情
router.get('/:id', getUserById);

// 创建用户
router.post('/', createUser);

// 更新用户信息
router.put('/:id', updateUser);

// 删除用户（软删除）
router.delete('/:id', deleteUser);

// 重置用户密码
router.put('/:id/password', resetUserPassword);

// 启用/禁用用户
router.put('/:id/status', toggleUserStatus);

export default router;

