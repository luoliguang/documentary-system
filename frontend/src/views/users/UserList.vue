<template>
  <div class="user-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>用户管理</h3>
          <div class="header-actions">
            <el-button type="primary" size="default" @click="handleCreate">
              <el-icon><Plus /></el-icon>
              创建用户
            </el-button>
          </div>
        </div>
      </template>

      <!-- 筛选条件 -->
      <div class="filters">
        <el-form :inline="!isMobile" :model="filters" class="filter-form">
          <el-form-item label="角色">
            <el-select v-model="filters.role" placeholder="全部" clearable class="filter-select">
              <el-option
                v-for="role in roles"
                :key="role.value"
                :label="role.label"
                :value="role.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态">
            <el-select v-model="filters.is_active" placeholder="全部" clearable class="filter-select">
              <el-option label="启用" :value="true" />
              <el-option label="禁用" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item label="搜索">
            <el-input
              v-model="filters.search"
              placeholder="用户名/公司名称/客户编号"
              clearable
              class="filter-input"
              @keyup.enter="loadUsers"
            />
          </el-form-item>
          <el-form-item class="filter-buttons">
            <el-button type="primary" @click="loadUsers">查询</el-button>
            <el-button @click="resetFilters">重置</el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 用户表格 -->
      <el-table v-loading="loading" :data="users" stripe style="width: 100%">
        <el-table-column prop="account" label="账号" width="150">
          <template #default="{ row }">
            <span>{{ row.account || row.username || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag
              :type="
                row.role === 'admin'
                  ? 'danger'
                  : row.role === 'production_manager'
                  ? 'warning'
                  : 'info'
              "
            >
              {{
                row.role === 'admin'
                  ? '管理员'
                  : row.role === 'production_manager'
                  ? '生产跟单'
                  : '客户'
              }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="company_name" label="公司名称" width="200" show-overflow-tooltip />
        <el-table-column prop="contact_name" label="联系人" width="120" />
        <el-table-column prop="customer_code" label="客户编号" width="120" />
        <el-table-column prop="admin_notes" label="管理员备注" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.admin_notes">{{ row.admin_notes }}</span>
            <span v-else style="color: #c0c4cc">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" link @click="handleEdit(row)">
              编辑
            </el-button>
            <el-button
              type="warning"
              size="small"
              link
              @click="handleResetPassword(row)"
            >
              重置密码
            </el-button>
            <el-button
              :type="row.is_active ? 'danger' : 'success'"
              size="small"
              link
              @click="handleToggleStatus(row)"
            >
              {{ row.is_active ? '禁用' : '启用' }}
            </el-button>
            <el-button
              v-if="row.id !== authStore.user?.id"
              type="danger"
              size="small"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <div class="pagination">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>

    <!-- 创建/编辑用户对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="currentUser ? '编辑用户' : '创建用户'"
      :width="isMobile ? '90%' : '600px'"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
      >
        <el-form-item label="账号" prop="account">
          <el-input
            v-model="form.account"
            placeholder="请输入登录账号（仅允许字母、数字、下划线）"
          />
          <div class="form-tip">账号用于登录，仅允许字母、数字、下划线，长度 3-50 个字符</div>
        </el-form-item>
        <el-form-item label="用户名" prop="username">
          <el-input
            v-model="form.username"
            placeholder="请输入用户名/显示名称（可以包含中文）"
          />
          <div class="form-tip">用户名用于显示，可以包含中文</div>
        </el-form-item>
        <el-form-item v-if="!currentUser" label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role" placeholder="请选择角色" style="width: 100%">
            <el-option
              v-for="role in roles"
              :key="role.value"
              :label="role.label"
              :value="role.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item
          v-if="form.role === 'customer'"
          label="客户编号"
          prop="customer_code"
        >
          <el-input
            v-model="form.customer_code"
            placeholder="请输入客户编号"
          />
        </el-form-item>
        <el-form-item label="公司名称">
          <el-input v-model="form.company_name" placeholder="请输入公司名称" />
        </el-form-item>
        <el-form-item label="联系人姓名">
          <el-input v-model="form.contact_name" placeholder="请输入联系人姓名" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="form.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item
          v-if="form.role === 'production_manager'"
          label="订单类型权限"
        >
          <el-checkbox-group v-model="form.assigned_order_types">
            <el-checkbox label="required">必发</el-checkbox>
            <el-checkbox label="scattered">散单</el-checkbox>
            <el-checkbox label="photo">拍照</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="管理员备注">
          <el-input
            v-model="form.admin_notes"
            type="textarea"
            :rows="3"
            placeholder="请输入管理员备注（用于标识具体客户）"
          />
        </el-form-item>
        <el-form-item v-if="currentUser" label="状态">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 重置密码对话框 -->
    <el-dialog v-model="passwordDialogVisible" title="重置密码" width="400px">
      <el-form ref="passwordFormRef" :model="passwordForm" :rules="passwordRules" label-width="100px">
        <el-form-item label="新密码" prop="new_password">
          <el-input
            v-model="passwordForm.new_password"
            type="password"
            placeholder="请输入新密码"
            show-password
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirm_password">
          <el-input
            v-model="passwordForm.confirm_password"
            type="password"
            placeholder="请再次输入密码"
            show-password
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="passwordDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPassword">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox, FormInstance } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';
import { usersApi } from '../../api/users';
import { useConfigOptions } from '../../composables/useConfigOptions';
import type { User } from '../../types';

const authStore = useAuthStore();
const loading = ref(false);
const users = ref<User[]>([]);
const pagination = ref({
  total: 0,
  page: 1,
  pageSize: 20,
  totalPages: 0,
});

// 配置选项
const { roles, loadRoles } = useConfigOptions();

const isMobile = ref(window.innerWidth <= 768);

const filters = reactive({
  role: '',
  is_active: undefined as boolean | undefined,
  search: '',
});

const currentPage = ref(1);
const pageSize = ref(20);
const dialogVisible = ref(false);
const currentUser = ref<User | null>(null);
const formRef = ref<FormInstance>();
const passwordDialogVisible = ref(false);
const currentPasswordUser = ref<User | null>(null);
const passwordFormRef = ref<FormInstance>();

const form = reactive({
  account: '',
  username: '',
  password: '',
  role: 'customer' as 'customer' | 'production_manager' | 'admin',
  customer_code: '',
  company_name: '',
  contact_name: '',
  email: '',
  phone: '',
  assigned_order_types: [] as string[],
  admin_notes: '',
  is_active: true,
});

const passwordForm = reactive({
  new_password: '',
  confirm_password: '',
});

const rules = {
  account: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,50}$/, message: '账号格式不正确，仅允许字母、数字、下划线，长度 3-50 个字符', trigger: 'blur' },
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (value && form.username && value === form.username) {
          callback(new Error('账号和用户名不能相同'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (value && form.account && value === form.account) {
          callback(new Error('用户名和账号不能相同'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  customer_code: [
    {
      required: true,
      message: '客户编号不能为空',
      trigger: 'blur',
      validator: (_rule: any, value: any, callback: any) => {
        if (form.role === 'customer' && !value) {
          callback(new Error('客户编号不能为空'));
        } else {
          callback();
        }
      },
    },
  ],
};

const passwordRules = {
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
  confirm_password: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (value !== passwordForm.new_password) {
          callback(new Error('两次输入的密码不一致'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
};

const formatDate = (date: string) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const loadUsers = async () => {
  loading.value = true;
  try {
    const response = await usersApi.getUsers({
      page: currentPage.value,
      pageSize: pageSize.value,
      role: filters.role || undefined,
      is_active: filters.is_active,
      search: filters.search || undefined,
    });
    users.value = response.users;
    pagination.value = response.pagination;
  } catch (error) {
    ElMessage.error('加载用户列表失败');
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.role = '';
  filters.is_active = undefined;
  filters.search = '';
  currentPage.value = 1;
  loadUsers();
};

const handleCreate = () => {
  currentUser.value = null;
  Object.assign(form, {
    account: '',
    username: '',
    password: '',
    role: 'customer',
    customer_code: '',
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    assigned_order_types: [],
    admin_notes: '',
    is_active: true,
  });
  dialogVisible.value = true;
};

const handleEdit = (row: User) => {
  currentUser.value = row;
  Object.assign(form, {
    account: row.account || row.username, // 如果没有 account，使用 username
    username: row.username,
    password: '',
    role: row.role,
    customer_code: row.customer_code || '',
    company_name: row.company_name || '',
    contact_name: row.contact_name || '',
    email: row.email || '',
    phone: row.phone || '',
    assigned_order_types: row.assigned_order_types || [],
    admin_notes: row.admin_notes || '',
    is_active: row.is_active,
  });
  dialogVisible.value = true;
};

const submitForm = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    try {
      if (currentUser.value) {
        // 更新用户
        const updateData: any = {
          account: form.account,
          username: form.username,
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          admin_notes: form.admin_notes,
          is_active: form.is_active,
        };
        if (form.role === 'production_manager') {
          updateData.assigned_order_types = form.assigned_order_types;
        }
        await usersApi.updateUser(currentUser.value.id, updateData);
        ElMessage.success('用户信息更新成功');
      } else {
        // 创建用户
        const createData: any = {
          account: form.account,
          username: form.username,
          password: form.password,
          role: form.role,
          company_name: form.company_name,
          contact_name: form.contact_name,
          email: form.email,
          phone: form.phone,
          admin_notes: form.admin_notes,
        };
        if (form.role === 'customer') {
          createData.customer_code = form.customer_code;
        }
        if (form.role === 'production_manager') {
          createData.assigned_order_types = form.assigned_order_types;
        }
        await usersApi.createUser(createData);
        ElMessage.success('用户创建成功');
      }
      dialogVisible.value = false;
      await loadUsers();
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '操作失败');
    }
  });
};

const handleResetPassword = (row: User) => {
  currentPasswordUser.value = row;
  passwordForm.new_password = '';
  passwordForm.confirm_password = '';
  passwordDialogVisible.value = true;
};

const submitPassword = async () => {
  if (!passwordFormRef.value || !currentPasswordUser.value) return;

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return;

    try {
      await usersApi.resetUserPassword(
        currentPasswordUser.value!.id,
        passwordForm.new_password
      );
      ElMessage.success('密码重置成功');
      passwordDialogVisible.value = false;
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '重置密码失败');
    }
  });
};

const handleToggleStatus = async (row: User) => {
  try {
    await usersApi.toggleUserStatus(row.id, !row.is_active);
    ElMessage.success(row.is_active ? '用户已禁用' : '用户已启用');
    await loadUsers();
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '操作失败');
  }
};

const handleDelete = async (row: User) => {
  try {
    await ElMessageBox.confirm(
      `确定要永久删除用户"${row.username || row.account}"吗？此操作不可恢复！`,
      '确认删除',
      {
        confirmButtonText: '确定删除',
        cancelButtonText: '取消',
        type: 'error',
        dangerouslyUseHTMLString: false,
      }
    );

    await usersApi.deleteUser(row.id);
    ElMessage.success('用户已永久删除');
    await loadUsers();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error(error.response?.data?.error || '删除失败');
    }
  }
};

const handleSizeChange = () => {
  currentPage.value = 1;
  loadUsers();
};

const handlePageChange = () => {
  loadUsers();
};

onMounted(() => {
  loadUsers();
  loadRoles();
});
</script>

<style scoped>
.user-list {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
}

.filters {
  margin-bottom: 20px;
}

.filter-form {
  width: 100%;
}

.filter-input,
.filter-select {
  width: 200px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  line-height: 1.4;
}

@media (max-width: 768px) {
  .filter-input,
  .filter-select {
    width: 100%;
  }
}
</style>

