<template>
  <div class="login-container">
    <div class="login-header">
      <el-icon :size="48" color="#409eff">
        <Document />
      </el-icon>
    </div>

    <el-card class="login-card">
      <template #header>
        <h2 class="login-title">客户门户登录</h2>
        <p class="login-subtitle">欢迎回来,请输入您的凭据</p>
      </template>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <template #label>
            <span class="form-label">账号/客户编号</span>
          </template>
          <el-input
            v-model="loginForm.username"
            placeholder="请输入您的账号"
            size="large"
            :prefix-icon="User"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password">
          <template #label>
            <span class="form-label">密码</span>
          </template>
          <el-input
            v-model="loginForm.password"
            type="password"
            placeholder="请输入您的密码"
            size="large"
            :prefix-icon="Lock"
            :suffix-icon="showPassword ? View : Hide"
            show-password
            @keyup.enter="handleLogin"
            clearable
          />
        </el-form-item>

        <div class="login-options">
          <el-checkbox v-model="rememberMe">记住我</el-checkbox>
          <el-link type="primary" :underline="false">忘记密码?</el-link>
        </div>

        <el-form-item>
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            class="login-button"
            @click="handleLogin"
          >
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="login-footer">
      <p>© 2024 跟单系统. All rights reserved.</p>
      <div class="footer-links">
        <el-link type="primary" :underline="false">技术支持</el-link>
        <span class="separator">|</span>
        <el-link type="primary" :underline="false">隐私政策</el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { User, Lock, View, Hide, Document } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const loginFormRef = ref<FormInstance>();
const loading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(false);

const loginForm = reactive({
  username: '',
  password: '',
});

const loginRules: FormRules = {
  username: [
    { required: true, message: '请输入账号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
  ],
};

const handleLogin = async () => {
  if (!loginFormRef.value) return;

  await loginFormRef.value.validate(async (valid) => {
    if (valid) {
      loading.value = true;
      try {
        await authStore.login(loginForm.username, loginForm.password);
        ElMessage.success('登录成功');
        router.push('/');
      } catch (error: any) {
        ElMessage.error(error.response?.data?.error || '登录失败');
      } finally {
        loading.value = false;
      }
    }
  });
};
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.login-header {
  margin-bottom: 30px;
}

.login-card {
  width: 100%;
  max-width: 450px;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.login-title {
  text-align: center;
  font-size: 24px;
  font-weight: bold;
  color: #303133;
  margin: 0 0 10px 0;
}

.login-subtitle {
  text-align: center;
  font-size: 14px;
  color: #909399;
  margin: 0;
}

.form-label {
  font-weight: 500;
  color: #606266;
}

.login-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.login-button {
  width: 100%;
  height: 45px;
  font-size: 16px;
}

.login-footer {
  margin-top: 40px;
  text-align: center;
  color: #909399;
  font-size: 14px;
}

.footer-links {
  margin-top: 10px;
}

.separator {
  margin: 0 10px;
  color: #dcdfe6;
}
</style>

