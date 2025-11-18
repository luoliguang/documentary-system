<template>
  <div class="login-container">
    <div class="login-header">
      <el-icon :size="48" color="#409eff">
        <EditPen />
      </el-icon>
      <!-- <img src="/favicon-32x32.png" alt="方度跟单系统" class="login-logo" /> -->
    </div>

    <el-card class="login-card">
      <template #header>
        <h2 class="login-title">方度跟单系统</h2>
        <p class="login-subtitle">专为优质客户提供的订单跟单系统</p>
      </template>

      <el-form
        ref="loginFormRef"
        :model="loginForm"
        :rules="loginRules"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="account">
          <template #label>
            <span class="form-label">账号</span>
          </template>
          <el-input
            v-model="loginForm.account"
            placeholder="请输入您的登录账号"
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
          <el-link type="primary" :underline="false" @click="handleForgotPassword">忘记密码?</el-link>
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
      <p>© 2025 方度跟单系统-LuoYangyang. All rights reserved.</p>
      <div class="footer-links">
        <el-link type="primary" :underline="false" @click="handleSupport">技术支持</el-link>
        <span class="separator">|</span>
        <el-link type="primary" :underline="false" @click="handlePrivacy">隐私政策</el-link>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { User, Lock, View, Hide, EditPen } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const loginFormRef = ref<FormInstance>();
const loading = ref(false);
const showPassword = ref(false);
const rememberMe = ref(false);

const loginForm = reactive({
  account: '',
  password: '',
});

const loginRules: FormRules = {
  account: [
    { required: true, message: '请输入账号', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,50}$/, message: '账号格式不正确，仅允许字母、数字、下划线，长度 3-50 个字符', trigger: 'blur' },
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
        await authStore.login(loginForm.account, loginForm.password);
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

const handleForgotPassword = () => {
  ElMessageBox.alert(
    `<div style="text-align: left; line-height: 1.8;">
      <p style="margin-bottom: 12px;"><strong>当前找回方式：</strong></p>
      <p style="margin-bottom: 8px;">如您忘记密码，请发送邮件至：<strong style="color: #409eff;">giluo@vip.qq.com</strong></p>
      <p style="margin-bottom: 8px;">邮件中请包含以下信息：</p>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>您的公司名称</li>
        <li>您的注册账号或电话号码</li>
        <li>简要说明您遇到的问题</li>
      </ul>
      <p style="margin-top: 12px; margin-bottom: 8px;">我们会在收到邮件后尽快处理，并将账号信息发送至您的邮箱，请注意查收。</p>
      <p style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e7ed; color: #909399; font-size: 13px;">
        <strong>温馨提示：</strong>我们正在开发手机号绑定和手机号登录功能，后续您将可以通过手机号快速找回密码和登录系统。
      </p>
    </div>`,
    '忘记密码',
    {
      confirmButtonText: '我知道了',
      type: 'info',
      dangerouslyUseHTMLString: true,
    }
  );
};

const handleSupport = () => {
  ElMessageBox.alert(
    `<div style="text-align: left; line-height: 1.8;">
      <p style="margin-bottom: 12px;"><strong>系统信息</strong></p>
      <p style="margin-bottom: 8px;">方度跟单系统由方度跟单个人独立开发，专为服装行业订单管理打造。</p>
      <p style="margin-top: 12px; margin-bottom: 8px;"><strong>技术支持</strong></p>
      <p style="margin-bottom: 8px;">如您在使用过程中遇到任何问题，或有功能建议，欢迎联系我们：</p>
      <p style="margin-bottom: 4px;">📧 邮箱：<strong style="color: #409eff;">giluo@vip.qq.com</strong></p>
      <p style="margin-top: 12px; color: #909399; font-size: 13px;">我们将持续优化系统功能，为您提供更好的使用体验。</p>
    </div>`,
    '技术支持',
    {
      confirmButtonText: '确定',
      type: 'info',
      dangerouslyUseHTMLString: true,
    }
  );
};

const handlePrivacy = () => {
  ElMessageBox.alert(
    `<div style="text-align: left; line-height: 1.8;">
      <p style="margin-bottom: 12px;"><strong>隐私政策</strong></p>
      <p style="margin-bottom: 8px;">方度跟单系统（以下简称"本系统"）非常重视用户的隐私保护。在使用本系统时，我们会收集和使用您的相关信息。</p>
      <p style="margin-top: 12px; margin-bottom: 8px;"><strong>信息收集与使用</strong></p>
      <ul style="margin: 8px 0; padding-left: 20px;">
        <li>我们仅收集系统运行所必需的信息，包括账号、密码等登录信息</li>
        <li>您的业务数据（订单、客户信息等）仅用于系统功能实现</li>
        <li>我们不会向第三方泄露您的任何信息</li>
      </ul>
      <p style="margin-top: 12px; margin-bottom: 8px;"><strong>数据安全</strong></p>
      <p style="margin-bottom: 8px;">我们采用行业标准的安全措施保护您的数据安全，防止未经授权的访问、使用或泄露。</p>
      <p style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e7ed; color: #909399; font-size: 13px;">
        <strong>最终解释权：</strong>本隐私政策的最终解释权归方度跟单所有。如有疑问，请联系我们。
      </p>
    </div>`,
    '隐私政策',
    {
      confirmButtonText: '确定',
      type: 'info',
      dangerouslyUseHTMLString: true,
    }
  );
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
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-logo {
  width: 48px;
  height: 48px;
  object-fit: contain;
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

