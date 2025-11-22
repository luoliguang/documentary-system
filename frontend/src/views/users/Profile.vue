<template>
  <div class="profile">
    <el-card>
      <template #header>
        <h3>个人中心</h3>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        style="max-width: 600px"
      >
        <el-form-item label="用户名">
          <el-input :value="authStore.user?.username" disabled />
        </el-form-item>
        <el-form-item label="角色">
          <el-input
            :value="
              authStore.user?.role === 'admin'
                ? '管理员'
                : authStore.user?.role === 'production_manager'
                ? '生产跟单'
                : '客户'
            "
            disabled
          />
        </el-form-item>
        <el-form-item v-if="authStore.user?.customer_code" label="客户编号">
          <el-input :value="authStore.user.customer_code" disabled />
        </el-form-item>
        <el-form-item v-if="authStore.user?.company_name" label="公司名称">
          <el-input :value="authStore.user.company_name" disabled />
        </el-form-item>
        <el-form-item label="联系人姓名" prop="contact_name">
          <el-input v-model="form.contact_name" placeholder="请输入联系人姓名" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="请输入邮箱" />
        </el-form-item>
        <el-form-item label="电话" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入电话" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="submitForm">保存</el-button>
        </el-form-item>
      </el-form>

      <el-divider />

      <el-card shadow="never">
        <template #header>
          <h4>通知设置</h4>
        </template>
        <el-form label-width="120px" style="max-width: 600px">
          <el-form-item label="桌面通知">
            <el-switch
              v-model="notificationEnabled"
              active-text="开启"
              inactive-text="关闭"
              @change="handleNotificationToggle"
            />
            <div style="margin-top: 8px; color: #909399; font-size: 12px">
              <p>开启后，当有新订单、催单或通知时，系统会在桌面显示提醒</p>
              <p v-if="notificationPermission === 'denied'" style="color: #f56c6c">
                ⚠️ 浏览器已拒绝通知权限，请在浏览器设置中允许通知权限
              </p>
              <p v-else-if="notificationPermission === 'default'" style="color: #e6a23c">
                ℹ️ 首次开启时会请求浏览器通知权限
              </p>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <el-divider />

      <el-card shadow="never">
        <template #header>
          <h4>修改密码</h4>
        </template>
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordRules"
          label-width="120px"
          style="max-width: 600px"
        >
          <el-form-item label="旧密码" prop="old_password">
            <el-input
              v-model="passwordForm.old_password"
              type="password"
              placeholder="请输入旧密码"
              show-password
            />
          </el-form-item>
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
              placeholder="请再次输入新密码"
              show-password
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="submitPassword">修改密码</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { ElMessage, FormInstance } from 'element-plus';
import { useAuthStore } from '../../stores/auth';
import { profileApi } from '../../api/users';

const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const passwordFormRef = ref<FormInstance>();

const form = reactive({
  contact_name: '',
  email: '',
  phone: '',
});

// 通知开关状态
const notificationEnabled = ref(authStore.notificationEnabled);

// 浏览器通知权限状态
const notificationPermission = computed(() => {
  if (typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
});

const passwordForm = reactive({
  old_password: '',
  new_password: '',
  confirm_password: '',
});

const rules = {
  email: [
    { type: 'email', message: '请输入正确的邮箱地址', trigger: 'blur' },
  ],
};

const passwordRules = {
  old_password: [
    { required: true, message: '请输入旧密码', trigger: 'blur' },
  ],
  new_password: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' },
    {
      validator: (_rule: any, value: any, callback: any) => {
        if (value === passwordForm.old_password) {
          callback(new Error('新密码不能与旧密码相同'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
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

const loadProfile = async () => {
  try {
    await authStore.fetchCurrentUser();
    if (authStore.user) {
      form.contact_name = authStore.user.contact_name || '';
      form.email = authStore.user.email || '';
      form.phone = authStore.user.phone || '';
    }
  } catch (error) {
    ElMessage.error('加载个人信息失败');
  }
};

const submitForm = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    try {
      await profileApi.updateProfile({
        contact_name: form.contact_name,
        email: form.email,
        phone: form.phone,
      });
      await authStore.fetchCurrentUser();
      ElMessage.success('个人信息更新成功');
    } catch (error: any) {
      ElMessage.error(error.response?.data?.error || '更新失败');
    }
  });
};

const submitPassword = async () => {
  if (!passwordFormRef.value) return;

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return;

    try {
      await profileApi.updatePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
      });
      ElMessage.success('密码修改成功');
      passwordForm.old_password = '';
      passwordForm.new_password = '';
      passwordForm.confirm_password = '';
    } catch (error: any) {
      const detailsMessage =
        error.response?.data?.details?.[0]?.message ||
        error.response?.data?.error ||
        '修改密码失败';
      ElMessage.error(detailsMessage);
    }
  });
};

// 处理通知开关切换
const handleNotificationToggle = async (enabled: boolean) => {
  try {
    // 如果开启，先请求浏览器权限
    if (enabled) {
      if (typeof Notification === 'undefined') {
        ElMessage.warning('您的浏览器不支持桌面通知');
        return;
      }

      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          ElMessage.warning('需要通知权限才能开启桌面通知');
          return;
        }
      } else if (Notification.permission === 'denied') {
        ElMessage.error('浏览器已拒绝通知权限，请在浏览器设置中允许');
        return;
      }
    }

    // 保存到后端
    await profileApi.updateProfile({
      notification_enabled: enabled,
    });

    // 更新本地状态
    authStore.updateNotificationEnabled(enabled);
    await authStore.fetchCurrentUser();

    ElMessage.success(enabled ? '桌面通知已开启' : '桌面通知已关闭');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新通知设置失败');
  }
};

// 监听authStore的notificationEnabled变化
watch(() => authStore.notificationEnabled, (newVal) => {
  notificationEnabled.value = newVal;
});

onMounted(() => {
  loadProfile();
  // 初始化通知开关状态
  notificationEnabled.value = authStore.notificationEnabled;
});
</script>

<style scoped>
.profile {
  width: 100%;
}
</style>

