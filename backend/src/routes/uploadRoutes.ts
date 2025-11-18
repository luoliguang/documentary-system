import express from 'express';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { uploadToOSS, getSignedUrl, extractOSSKey } from '../services/ossService.js';

const router = express.Router();

// 文件过滤器：只允许图片
const fileFilter = (req: express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('只能上传图片文件！'));
  }
};

// 使用内存存储，直接获取文件Buffer上传到OSS
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// 图片上传接口
router.post('/image', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传文件' });
    }

    // 上传到OSS
    const result = await uploadToOSS(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // 如果使用私有Bucket，需要生成签名URL
    let imageUrl = result.url;
    try {
      const signedUrl = await getSignedUrl(result.key, 3600 * 24 * 7); // 7天有效期
      imageUrl = signedUrl;
    } catch (error) {
      // 如果生成签名URL失败，使用原始URL（可能是公共读Bucket）
      console.warn('生成签名URL失败，使用原始URL:', error);
    }

    res.json({
      message: '图片上传成功',
      url: imageUrl,
      key: result.key, // 保存OSS key，用于后续操作
      filename: req.file.originalname,
    });
  } catch (error: any) {
    console.error('上传失败:', error);
    res.status(500).json({ 
      error: '图片上传失败',
      message: error.message || '未知错误'
    });
  }
});

// 获取签名URL接口（用于访问私有文件）
router.post('/signed-url', authenticateToken, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: '请提供有效的图片URL' });
    }

    // 从URL中提取OSS key
    const ossKey = extractOSSKey(url);
    
    if (!ossKey) {
      return res.status(400).json({ error: '无效的OSS图片URL' });
    }

    // 生成签名URL，默认1小时有效期
    const expires = parseInt(req.body.expires) || 3600;
    const signedUrl = await getSignedUrl(ossKey, expires);

    res.json({
      url: signedUrl,
      expires: expires,
    });
  } catch (error: any) {
    console.error('获取签名URL失败:', error);
    res.status(500).json({ 
      error: '获取签名URL失败',
      message: error.message || '未知错误'
    });
  }
});

export default router;

