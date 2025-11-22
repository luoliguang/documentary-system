import { Response } from 'express';
import { pool } from '../config/database.js';
import { AuthRequest } from '../middleware/auth.js';
import { hashPassword, comparePassword } from '../utils/password.js';

// 获取用户列表（仅管理员）
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const {
      role,
      is_active,
      search,
      page = 1,
      pageSize = 20,
    } = req.query;

    let whereConditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`role = $${paramIndex++}`);
      params.push(role);
    }

    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex++}`);
      params.push(is_active === 'true');
    }

    if (search) {
      whereConditions.push(
        `(username ILIKE $${paramIndex++} OR company_name ILIKE $${paramIndex++} OR contact_name ILIKE $${paramIndex++} OR customer_code ILIKE $${paramIndex++})`
      );
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    const whereClause =
      whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

    const offset = (Number(page) - 1) * Number(pageSize);
    
    // 保存 where 条件的参数（用于 COUNT 查询）
    const whereParams = [...params];
    
    // 添加 LIMIT 和 OFFSET 参数
    const limitParamIndex = paramIndex++;
    const offsetParamIndex = paramIndex++;
    params.push(Number(pageSize), offset);

    // 先尝试使用新字段查询，如果字段不存在则使用备用查询
    let countResult: any;
    let result: any;
    
    try {
      // 尝试使用包含 account 和 admin_notes 的查询
      const query = `
        SELECT 
          id, account, username, customer_code, role, company_name, contact_name, 
          email, phone, assigned_order_types, admin_notes, is_active, 
          created_at, updated_at
        FROM users
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
      `;
      const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
      
      countResult = await pool.query(
        countQuery,
        whereParams.length > 0 ? whereParams : []
      );
      result = await pool.query(query, params);
      
      // 验证查询结果中 account 和 username 是否正确
      // 注意：这里只记录警告，不修改数据，因为新创建的用户应该有正确的 account
      result.rows.forEach((row: any, index: number) => {
        if (row.account === row.username && index < 3) {
          console.log(`警告：用户 ${row.id} (${row.username}) 的 account 和 username 相同`, {
            account: row.account,
            username: row.username,
            accountType: typeof row.account,
            usernameType: typeof row.username,
          });
        }
        // 如果 account 是 undefined 或 null，记录错误但不修改（这可能是数据库问题）
        if ((row.account === undefined || row.account === null) && row.username) {
          console.error(`错误：用户 ${row.id} (${row.username}) 的 account 是 undefined 或 null！`, {
            account: row.account,
            username: row.username,
          });
        }
      });
    } catch (error: any) {
      // 如果字段不存在，使用旧的查询（向后兼容）
      if (error.code === '42703') {
        try {
          // 尝试包含 admin_notes 但不包含 account
          const query = `
            SELECT 
              id, username, customer_code, role, company_name, contact_name, 
              email, phone, assigned_order_types, admin_notes, is_active, 
              created_at, updated_at
            FROM users
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
          `;
          const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
          
          countResult = await pool.query(
            countQuery,
            whereParams.length > 0 ? whereParams : undefined
          );
          result = await pool.query(query, params);
          
          // 为旧数据添加默认值
          result.rows.forEach((row: any) => {
            row.account = row.username; // 使用 username 作为 account
            row.admin_notes = null;
          });
        } catch (innerError: any) {
          // 如果 admin_notes 也不存在
          if (innerError.code === '42703') {
            const query = `
              SELECT 
                id, username, customer_code, role, company_name, contact_name, 
                email, phone, assigned_order_types, is_active, 
                created_at, updated_at
              FROM users
              ${whereClause}
              ORDER BY created_at DESC
              LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
            `;
            const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
            
            countResult = await pool.query(
              countQuery,
              whereParams.length > 0 ? whereParams : undefined
            );
            result = await pool.query(query, params);
            
            // 为旧数据添加默认值
            result.rows.forEach((row: any) => {
              row.account = row.username; // 使用 username 作为 account
              row.admin_notes = null;
            });
          } else {
            throw innerError;
          }
        }
      } else {
        throw error;
      }
    }

    res.json({
      users: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].total),
        page: Number(page),
        pageSize: Number(pageSize),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].total) / Number(pageSize)
        ),
      },
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 获取用户详情（仅管理员）
export const getUserById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    let result;
    try {
      result = await pool.query(
        `SELECT 
          id, account, username, customer_code, role, company_name, contact_name, 
          email, phone, assigned_order_types, admin_notes, is_active, 
          created_at, updated_at
        FROM users WHERE id = $1`,
        [id]
      );
    } catch (error: any) {
      // 如果字段不存在，使用旧的查询（向后兼容）
      if (error.code === '42703') {
        try {
          // 尝试包含 admin_notes 但不包含 account
          result = await pool.query(
            `SELECT 
              id, username, customer_code, role, company_name, contact_name, 
              email, phone, assigned_order_types, admin_notes, is_active, 
              created_at, updated_at
            FROM users WHERE id = $1`,
            [id]
          );
          // 为旧数据添加默认值
          if (result.rows.length > 0) {
            result.rows[0].account = result.rows[0].username; // 使用 username 作为 account
          }
        } catch (innerError: any) {
          // 如果 admin_notes 也不存在
          if (innerError.code === '42703') {
            result = await pool.query(
              `SELECT 
                id, username, customer_code, role, company_name, contact_name, 
                email, phone, assigned_order_types, is_active, 
                created_at, updated_at
              FROM users WHERE id = $1`,
              [id]
            );
            // 为旧数据添加默认值
            if (result.rows.length > 0) {
              result.rows[0].account = result.rows[0].username; // 使用 username 作为 account
              result.rows[0].admin_notes = null;
            }
          } else {
            throw innerError;
          }
        }
      } else {
        throw error;
      }
    }

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 创建用户（仅管理员）
export const createUser = async (req: AuthRequest, res: Response) => {
  try {
    const {
      account,
      username,
      password,
      role = 'customer',
      customer_code,
      company_name,
      contact_name,
      email,
      phone,
      admin_notes,
      assigned_order_types,
    } = req.body;

    if (!password) {
      return res.status(400).json({ error: '密码不能为空' });
    }

    // 账号是必填的
    if (!account) {
      return res.status(400).json({ error: '账号不能为空' });
    }

    // 验证账号格式：仅允许字母、数字、下划线，长度 3-50
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(account)) {
      return res.status(400).json({ 
        error: '账号格式不正确，仅允许字母、数字、下划线，长度 3-50 个字符' 
      });
    }

    // 用户名是必填的
    if (!username) {
      return res.status(400).json({ error: '用户名不能为空' });
    }

    // 确保 account 和 username 是不同的值（先 trim 再比较）
    const finalAccount = String(account).trim();
    const finalUsername = String(username).trim();

    // 账号和用户名不能相同（避免混淆）
    if (finalAccount === finalUsername) {
      return res.status(400).json({ 
        error: '账号和用户名不能相同，请使用不同的值' 
      });
    }
    
    // 添加调试日志（使用更明显的格式）
    console.log('\n========== 创建用户 - 开始 ==========');
    console.log('接收到的原始数据:');
    console.log('  account:', req.body.account, '(类型:', typeof req.body.account, ')');
    console.log('  username:', req.body.username, '(类型:', typeof req.body.username, ')');
    console.log('处理后的数据:');
    console.log('  finalAccount:', finalAccount);
    console.log('  finalUsername:', finalUsername);
    console.log('  是否相同:', finalAccount === finalUsername);
    console.log('=====================================\n');

    if (role === 'customer' && !customer_code) {
      return res.status(400).json({ error: '客户角色必须提供客户编号' });
    }

    // 检查账号是否已存在
    let accountExists = false;
    try {
      const existingAccount = await pool.query(
        'SELECT id FROM users WHERE account = $1',
        [finalAccount]
      );
      accountExists = existingAccount.rows.length > 0;
    } catch (error: any) {
      // 如果 account 字段不存在（向后兼容），跳过检查
      if (error.code !== '42703') {
        throw error;
      }
    }

    if (accountExists) {
      return res.status(400).json({ error: '账号已存在' });
    }

    // 检查用户名是否已存在
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [finalUsername]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 检查客户编号是否已存在（如果是客户角色）
    if (customer_code) {
      const existingCode = await pool.query(
        'SELECT id FROM users WHERE customer_code = $1',
        [customer_code]
      );

      if (existingCode.rows.length > 0) {
        return res.status(400).json({ error: '客户编号已存在' });
      }
    }

    // 加密密码
    const passwordHash = await hashPassword(password);

    // 如果是客户角色且有公司名，查找或创建公司记录并设置 company_id
    let finalCompanyId: number | null = null;
    if (role === 'customer' && company_name) {
      const trimmedCompanyName = String(company_name).trim();
      if (trimmedCompanyName) {
        // 查找是否已存在该公司
        let companyResult = await pool.query(
          'SELECT id FROM customer_companies WHERE company_name = $1',
          [trimmedCompanyName]
        );
        
        if (companyResult.rows.length === 0) {
          // 创建新公司记录
          companyResult = await pool.query(
            `INSERT INTO customer_companies (company_name, contact_name, email, phone, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [
              trimmedCompanyName,
              contact_name || null,
              email || null,
              phone || null,
              'Auto-created when creating user'
            ]
          );
        }
        finalCompanyId = companyResult.rows[0].id;
      }
    }

    // 检查 admin_notes 字段是否存在
    let hasAdminNotes = false;
    try {
      const checkResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'admin_notes'`
      );
      hasAdminNotes = checkResult.rows.length > 0;
    } catch (error) {
      // 如果检查失败，假设字段不存在
      hasAdminNotes = false;
    }

    // 检查 account 字段是否存在
    let hasAccount = false;
    try {
      const checkAccountResult = await pool.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'users' AND column_name = 'account'`
      );
      hasAccount = checkAccountResult.rows.length > 0;
      
      // 如果 account 字段不存在，尝试添加它
      if (!hasAccount) {
        console.log('⚠️  数据库中没有 account 字段，正在添加...');
        try {
          // 先添加字段（允许为空）
          await pool.query(`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS account VARCHAR(50)
          `);
          
          // 为现有用户生成 account（基于 username 或 id）
          await pool.query(`
            UPDATE users 
            SET account = CASE 
              WHEN username ~ '^[a-zA-Z0-9_]+$' THEN username
              ELSE 'user_' || id::text
            END
            WHERE account IS NULL
          `);
          
          // 创建唯一索引（在设置 NOT NULL 之前，避免约束冲突）
          await pool.query(`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account ON users(account)
          `);
          
          // 注意：不设置 NOT NULL，因为新插入的用户可能还没有 account
          // 在插入时直接提供 account 值即可
          
          // 重新检查字段是否成功添加
          const recheckResult = await pool.query(
            `SELECT column_name FROM information_schema.columns 
             WHERE table_name = 'users' AND column_name = 'account'`
          );
          hasAccount = recheckResult.rows.length > 0;
          
          if (hasAccount) {
            console.log('✅ account 字段已成功添加并验证');
          } else {
            console.error('❌ account 字段添加后验证失败，字段检查仍为 false');
          }
        } catch (addFieldError: any) {
          console.error('❌ 添加 account 字段失败:', addFieldError.message);
          console.error('错误代码:', addFieldError.code);
          // 继续执行，但 hasAccount 仍然是 false
          hasAccount = false;
        }
      }
    } catch (error) {
      hasAccount = false;
    }

    // 创建用户
    let result: any;
    console.log('字段检查结果:');
    console.log('  hasAccount:', hasAccount);
    console.log('  hasAdminNotes:', hasAdminNotes);
    console.log('  将使用分支:', hasAccount && hasAdminNotes ? 'hasAccount && hasAdminNotes' : 
                hasAccount ? 'hasAccount' : 
                hasAdminNotes ? 'hasAdminNotes' : '向后兼容');
    
    if (hasAccount && hasAdminNotes) {
      // 有 account 和 admin_notes 字段
      console.log('\n========== 准备插入数据库 ==========');
      console.log('插入参数:');
      console.log('  $1 (account):', finalAccount);
      console.log('  $2 (username):', finalUsername);
      console.log('  $3 (password_hash):', passwordHash?.substring(0, 20) + '...');
      console.log('  $4 (role):', role);
      console.log('  其他参数: ...');
      console.log('=====================================\n');
      
      try {
        result = await pool.query(
          `INSERT INTO users (
            account, username, password_hash, role, customer_code, company_name, 
            contact_name, email, phone, admin_notes, assigned_order_types, company_id
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING id, account, username, customer_code, role, company_name, contact_name, 
                    email, phone, assigned_order_types, admin_notes, is_active, created_at`,
          [
            finalAccount,
            finalUsername,
            passwordHash,
            role,
            customer_code || null,
            company_name || null,
            contact_name || null,
            email || null,
            phone || null,
            admin_notes || null,
            assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
            finalCompanyId,
          ]
        );
        console.log('\n========== 数据库插入返回结果 ==========');
        console.log('原始返回数据:', JSON.stringify(result.rows[0], null, 2));
        console.log('解析后的数据:');
        console.log('  account:', result.rows[0].account, '(类型:', typeof result.rows[0].account, ')');
        console.log('  username:', result.rows[0].username, '(类型:', typeof result.rows[0].username, ')');
        console.log('  account === username:', result.rows[0].account === result.rows[0].username);
        console.log('  account === finalAccount:', result.rows[0].account === finalAccount);
        console.log('  username === finalUsername:', result.rows[0].username === finalUsername);
        console.log('========================================\n');
      } catch (insertError: any) {
        console.error('插入数据库错误:', insertError);
        throw insertError;
      }
      
      // 确保 account 和 username 正确（处理 undefined/null 的情况）
      if (result.rows[0].account === undefined || result.rows[0].account === null || result.rows[0].account !== finalAccount) {
        console.warn('警告：返回的 account 与提交的不一致或为 undefined/null，使用提交的值覆盖。', {
          returned: result.rows[0].account,
          submitted: finalAccount,
        });
        result.rows[0].account = finalAccount;
      }
      if (result.rows[0].username === undefined || result.rows[0].username === null || result.rows[0].username !== finalUsername) {
        console.warn('警告：返回的 username 与提交的不一致或为 undefined/null，使用提交的值覆盖。', {
          returned: result.rows[0].username,
          submitted: finalUsername,
        });
        result.rows[0].username = finalUsername;
      }
      
      // 双重检查：确保 account 和 username 已正确设置
      if (!result.rows[0].account || result.rows[0].account !== finalAccount) {
        console.error('错误：account 仍然不正确，强制设置为提交的值');
        result.rows[0].account = finalAccount;
        
        // 如果数据库返回的 account 是 undefined，需要更新数据库
        if (result.rows[0].id && (result.rows[0].account === undefined || result.rows[0].account === null)) {
          console.warn('尝试更新数据库中的 account 字段');
          try {
            await pool.query(
              'UPDATE users SET account = $1 WHERE id = $2',
              [finalAccount, result.rows[0].id]
            );
            console.log('已更新数据库中的 account 字段');
          } catch (updateError: any) {
            console.error('更新数据库 account 字段失败:', updateError);
          }
        }
      }
      if (!result.rows[0].username || result.rows[0].username !== finalUsername) {
        console.error('错误：username 仍然不正确，强制设置为提交的值');
        result.rows[0].username = finalUsername;
      }
    } else if (hasAccount) {
      // 有 account 字段但没有 admin_notes
      result = await pool.query(
        `INSERT INTO users (
          account, username, password_hash, role, customer_code, company_name, 
          contact_name, email, phone, assigned_order_types, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, account, username, customer_code, role, company_name, contact_name, 
                  email, phone, assigned_order_types, is_active, created_at`,
        [
          finalAccount,
          finalUsername,
          passwordHash,
          role,
          customer_code || null,
          company_name || null,
          contact_name || null,
          email || null,
          phone || null,
          assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
          finalCompanyId,
        ]
      );
      result.rows[0].admin_notes = null;
      // 确保 account 和 username 正确
      if (result.rows[0].account !== finalAccount) {
        console.warn('警告：返回的 account 与提交的不一致，使用提交的值覆盖。', {
          returned: result.rows[0].account,
          submitted: finalAccount,
        });
        result.rows[0].account = finalAccount;
      }
      if (result.rows[0].username !== finalUsername) {
        console.warn('警告：返回的 username 与提交的不一致，使用提交的值覆盖。', {
          returned: result.rows[0].username,
          submitted: finalUsername,
        });
        result.rows[0].username = finalUsername;
      }
    } else if (hasAdminNotes) {
      // 没有 account 字段但有 admin_notes（向后兼容）
      result = await pool.query(
        `INSERT INTO users (
          username, password_hash, role, customer_code, company_name, 
          contact_name, email, phone, admin_notes, assigned_order_types, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, username, customer_code, role, company_name, contact_name, 
                  email, phone, assigned_order_types, admin_notes, is_active, created_at`,
        [
          finalUsername,
          passwordHash,
          role,
          customer_code || null,
          company_name || null,
          contact_name || null,
          email || null,
          phone || null,
          admin_notes || null,
          assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
          finalCompanyId,
        ]
      );
    } else {
      // 都没有（向后兼容）
      result = await pool.query(
        `INSERT INTO users (
          username, password_hash, role, customer_code, company_name, 
          contact_name, email, phone, assigned_order_types, company_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, username, customer_code, role, company_name, contact_name, 
                  email, phone, assigned_order_types, is_active, created_at`,
        [
          finalUsername,
          passwordHash,
          role,
          customer_code || null,
          company_name || null,
          contact_name || null,
          email || null,
          phone || null,
          assigned_order_types ? JSON.stringify(assigned_order_types) : '[]',
          finalCompanyId,
        ]
      );
      result.rows[0].admin_notes = null;
    }

    // 确保返回的数据中 account 和 username 是正确的
    const createdUser = result.rows[0];
    console.log('创建用户 - 保存的数据（修复前）:', {
      account: createdUser.account,
      username: createdUser.username,
      finalAccount,
      finalUsername,
      accountMatch: createdUser.account === finalAccount,
      usernameMatch: createdUser.username === finalUsername,
      areEqual: createdUser.account === createdUser.username,
    });
    
    // 强制确保 account 和 username 正确（处理所有异常情况）
    if (createdUser.account === undefined || createdUser.account === null || createdUser.account !== finalAccount) {
      console.warn('修复：account 不正确，使用提交的值覆盖。', {
        returned: createdUser.account,
        submitted: finalAccount,
      });
      createdUser.account = finalAccount;
    }
    
    if (createdUser.username === undefined || createdUser.username === null || createdUser.username !== finalUsername) {
      console.warn('修复：username 不正确，使用提交的值覆盖。', {
        returned: createdUser.username,
        submitted: finalUsername,
      });
      createdUser.username = finalUsername;
    }
    
    // 如果 account 和 username 相同，但提交时不同，强制使用提交的值
    if (createdUser.account === createdUser.username && finalAccount !== finalUsername) {
      console.error('错误：account 和 username 相同，但提交时不同！强制使用提交的值。', {
        submitted: { account: finalAccount, username: finalUsername },
        returned: { account: createdUser.account, username: createdUser.username },
      });
      createdUser.account = finalAccount;
      createdUser.username = finalUsername;
    }
    
    console.log('创建用户 - 保存的数据（修复后）:', {
      account: createdUser.account,
      username: createdUser.username,
      finalAccount,
      finalUsername,
      accountMatch: createdUser.account === finalAccount,
      usernameMatch: createdUser.username === finalUsername,
      areEqual: createdUser.account === createdUser.username,
    });
    
    // 立即查询数据库验证数据是否正确保存
    if (createdUser.id) {
      try {
        // 先检查 account 字段是否存在
        const checkAccountField = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'account'`
        );
        const accountFieldExists = checkAccountField.rows.length > 0;
        
        if (accountFieldExists) {
          // 如果 account 字段存在，正常验证
          const verifyResult = await pool.query(
            'SELECT id, account, username FROM users WHERE id = $1',
            [createdUser.id]
          );
          if (verifyResult.rows.length > 0) {
            const dbUser = verifyResult.rows[0];
            console.log('========== 数据库验证结果 ==========');
            console.log('数据库中的 account:', dbUser.account);
            console.log('数据库中的 username:', dbUser.username);
            console.log('期望的 account:', finalAccount);
            console.log('期望的 username:', finalUsername);
            console.log('account 匹配:', dbUser.account === finalAccount);
            console.log('username 匹配:', dbUser.username === finalUsername);
            console.log('====================================');
            
            // 如果数据库中的 account 不正确，立即修复
            if (dbUser.account !== finalAccount) {
              console.error('❌ 错误：数据库中的 account 不正确！正在修复...');
              await pool.query(
                'UPDATE users SET account = $1 WHERE id = $2',
                [finalAccount, createdUser.id]
              );
              console.log('✅ 已修复数据库中的 account 字段');
              
              // 重新查询验证
              const reVerifyResult = await pool.query(
                'SELECT id, account, username FROM users WHERE id = $1',
                [createdUser.id]
              );
              console.log('修复后的数据库数据:', reVerifyResult.rows[0]);
              
              // 更新返回的数据
              createdUser.account = finalAccount;
            }
          }
        } else {
          // 如果 account 字段不存在，提示需要运行迁移
          console.warn('⚠️  数据库中没有 account 字段，无法验证 account 值');
          console.warn('建议运行迁移脚本添加 account 字段');
          console.error('请运行数据库迁移脚本添加 account 字段：');
          console.error('  database/migrations/003_add_account_field.sql');
          console.error('或者运行: npm run migrate:account');
          
          // 只验证 username
          const verifyResult = await pool.query(
            'SELECT id, username FROM users WHERE id = $1',
            [createdUser.id]
          );
          if (verifyResult.rows.length > 0) {
            const dbUser = verifyResult.rows[0];
            console.log('数据库中的 username:', dbUser.username);
            console.log('期望的 username:', finalUsername);
            console.log('username 匹配:', dbUser.username === finalUsername);
          }
        }
      } catch (verifyError: any) {
        console.error('验证数据库数据时出错:', verifyError.message);
        console.error('错误代码:', verifyError.code);
      }
    }

    res.status(201).json({
      message: '用户创建成功',
      user: createdUser,
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 更新用户信息（仅管理员）
export const updateUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      account,
      username,
      role,
      customer_code,
      company_name,
      contact_name,
      email,
      phone,
      admin_notes,
      assigned_order_types,
      is_active,
    } = req.body;

    // 检查用户是否存在
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const existingUser = userResult.rows[0];
    const allowedRoles: Array<'admin' | 'production_manager' | 'customer'> = [
      'admin',
      'production_manager',
      'customer',
    ];
    let targetRole: 'admin' | 'production_manager' | 'customer' =
      existingUser.role;

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // 更新账号（如果 account 字段存在）
    if (account !== undefined) {
      // 验证账号格式
      if (!/^[a-zA-Z0-9_]{3,50}$/.test(account)) {
        return res.status(400).json({ 
          error: '账号格式不正确，仅允许字母、数字、下划线，长度 3-50 个字符' 
        });
      }
      
      // 检查账号是否已被其他用户使用
      let accountExists = false;
      try {
        const existingAccount = await pool.query(
          'SELECT id FROM users WHERE account = $1 AND id != $2',
          [account, id]
        );
        accountExists = existingAccount.rows.length > 0;
      } catch (error: any) {
        // 如果 account 字段不存在（向后兼容），跳过检查
        if (error.code !== '42703') {
          throw error;
        }
      }
      
      if (accountExists) {
        return res.status(400).json({ error: '账号已被使用' });
      }
      
      // 检查 account 字段是否存在
      try {
        const checkResult = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'account'`
        );
        if (checkResult.rows.length > 0) {
          updates.push(`account = $${paramIndex++}`);
          values.push(account);
        }
      } catch (error) {
        console.warn('account 字段不存在，跳过更新');
      }
    }

    // 更新用户名
    if (username !== undefined) {
      // 检查用户名是否已被其他用户使用
      const existingUsername = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      
      if (existingUsername.rows.length > 0) {
        return res.status(400).json({ error: '用户名已被使用' });
      }
      
      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }

    // 更新角色
    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ error: '无效的角色类型' });
      }
      targetRole = role;
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    // 更新客户编号（仅客户角色）
    if (targetRole === 'customer') {
      let finalCustomerCode =
        customer_code !== undefined
          ? customer_code
          : existingUser.customer_code;
      if (typeof finalCustomerCode === 'string') {
        finalCustomerCode = finalCustomerCode.trim();
      }
      if (!finalCustomerCode) {
        return res
          .status(400)
          .json({ error: '客户角色必须提供客户编号' });
      }

      const existingCode = await pool.query(
        'SELECT id FROM users WHERE customer_code = $1 AND id != $2',
        [finalCustomerCode, id]
      );
      if (existingCode.rows.length > 0) {
        return res.status(400).json({ error: '客户编号已被使用' });
      }

      updates.push(`customer_code = $${paramIndex++}`);
      values.push(finalCustomerCode);
    } else if (
      customer_code !== undefined ||
      existingUser.customer_code !== null
    ) {
      // 非客户角色清空客户编号
      updates.push(`customer_code = $${paramIndex++}`);
      values.push(null);
    }

    if (company_name !== undefined) {
      updates.push(`company_name = $${paramIndex++}`);
      values.push(company_name);
    }
    if (contact_name !== undefined) {
      updates.push(`contact_name = $${paramIndex++}`);
      values.push(contact_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramIndex++}`);
      values.push(phone);
    }
    if (admin_notes !== undefined) {
      // 检查字段是否存在，如果不存在则跳过
      try {
        // 先尝试查询字段是否存在
        const checkResult = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_name = 'users' AND column_name = 'admin_notes'`
        );
        if (checkResult.rows.length > 0) {
          updates.push(`admin_notes = $${paramIndex++}`);
          values.push(admin_notes);
        }
      } catch (error) {
        // 如果检查失败，跳过该字段
        console.warn('admin_notes 字段不存在，跳过更新');
      }
    }
    const existingAssignedTypes = Array.isArray(
      existingUser.assigned_order_types
    )
      ? existingUser.assigned_order_types
      : existingUser.assigned_order_types
      ? JSON.parse(existingUser.assigned_order_types)
      : [];

    if (targetRole === 'production_manager') {
      const finalAssigned =
        Array.isArray(assigned_order_types) && assigned_order_types.length > 0
          ? assigned_order_types
          : existingAssignedTypes;
      updates.push(`assigned_order_types = $${paramIndex++}`);
      values.push(JSON.stringify(finalAssigned || []));
    } else if (
      assigned_order_types !== undefined ||
      (Array.isArray(existingAssignedTypes) &&
        existingAssignedTypes.length > 0)
    ) {
      updates.push(`assigned_order_types = $${paramIndex++}`);
      values.push(JSON.stringify([]));
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '没有要更新的字段' });
    }

    values.push(id);
    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(updateQuery, values);

    res.json({
      message: '用户信息更新成功',
      user: result.rows[0],
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 删除用户（仅管理员，硬删除）
export const deleteUser = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];

    // 不能删除自己
    if (user.id === req.user!.userId) {
      return res.status(400).json({ error: '不能删除自己的账号' });
    }

    // 检查用户是否有关联的订单（作为客户）
    const customerOrders = await pool.query(
      'SELECT COUNT(*) as count FROM orders WHERE customer_id = $1',
      [id]
    );
    const orderCount = parseInt(customerOrders.rows[0].count);
    
    if (orderCount > 0) {
      return res.status(400).json({ 
        error: `无法删除该用户，因为该用户有 ${orderCount} 个关联订单。请先处理这些订单。` 
      });
    }

    // 开始事务，清理所有引用
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. 清除订单中的 assigned_to 引用（设置为 NULL）
      await client.query(
        'UPDATE orders SET assigned_to = NULL WHERE assigned_to = $1',
        [id]
      );

      // 1.1 删除订单分配关系
      await client.query(
        'DELETE FROM order_assignments WHERE production_manager_id = $1',
        [id]
      );

      // 2. 清除订单中的 created_by 引用（设置为 NULL）
      await client.query(
        'UPDATE orders SET created_by = NULL WHERE created_by = $1',
        [id]
      );

      // 3. 清除催货记录中的 assigned_to 引用（设置为 NULL）
      await client.query(
        'UPDATE delivery_reminders SET assigned_to = NULL WHERE assigned_to = $1',
        [id]
      );

      // 4. 清除订单状态历史中的 changed_by 引用（设置为 NULL）
      await client.query(
        'UPDATE order_status_history SET changed_by = NULL WHERE changed_by = $1',
        [id]
      );

      // 5. 删除用户
      await client.query('DELETE FROM users WHERE id = $1', [id]);

      await client.query('COMMIT');

      res.json({
        message: '用户已永久删除',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 重置用户密码（仅管理员）
export const resetUserPassword = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      return res.status(400).json({ error: '新密码不能为空' });
    }

    // 检查用户是否存在
    const userResult = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 加密新密码
    const passwordHash = await hashPassword(new_password);

    // 更新密码
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      passwordHash,
      id,
    ]);

    res.json({
      message: '密码重置成功',
    });
  } catch (error) {
    console.error('重置密码错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

// 启用/禁用用户（仅管理员）
export const toggleUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ error: 'is_active 必须是布尔值' });
    }

    // 检查用户是否存在
    const userResult = await pool.query('SELECT id FROM users WHERE id = $1', [
      id,
    ]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const user = userResult.rows[0];
    
    // 不能禁用自己
    if (user.id === req.user!.userId && !is_active) {
      return res.status(400).json({ error: '不能禁用自己的账号' });
    }

    // 更新状态
    await pool.query('UPDATE users SET is_active = $1 WHERE id = $2', [
      is_active,
      id,
    ]);

    res.json({
      message: is_active ? '用户已启用' : '用户已禁用',
    });
  } catch (error) {
    console.error('更新用户状态错误:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

