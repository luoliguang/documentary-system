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
          <el-form-item label="通知提醒">
            <el-switch
              v-model="notificationEnabled"
              active-text="开启"
              inactive-text="关闭"
              :disabled="isIOS && !isCapacitor && !notificationSupportInfo.supported"
              @change="handleNotificationToggle"
            />
            <div style="margin-top: 8px; color: #909399; font-size: 12px">
              <p v-if="isCapacitor">开启后，当有新订单、催单或通知时，系统会通过App推送通知</p>
              <p v-else-if="isMobile">开启后，当有新订单、催单或通知时，系统会显示通知提醒</p>
              <p v-else>开启后，当有新订单、催单或通知时，系统会在桌面显示提醒</p>
              
              <!-- iOS Safari特殊提示 -->
              <div v-if="isIOS && !isCapacitor" style="margin-top: 8px;">
                <p style="color: #f56c6c; font-weight: 500;">
                  ⚠️ iOS Safari浏览器不支持Web通知API
                </p>
                <p style="color: #909399; margin-top: 4px; font-size: 11px;">
                  如需接收通知，请使用App版本（已打包为iOS App时自动使用系统通知）
                </p>
              </div>
              
              <!-- Android浏览器提示 -->
              <div v-else-if="isAndroid && !isCapacitor" style="margin-top: 8px;">
                <p v-if="!notificationSupportInfo.supported" style="color: #e6a23c">
                  ⚠️ 当前Android浏览器不支持通知，建议使用App版本
                </p>
                <p v-else-if="notificationPermission === 'denied'" style="color: #f56c6c">
                  ⚠️ 浏览器已拒绝通知权限，请在浏览器设置中允许通知权限
                </p>
                <p v-else-if="notificationPermission === 'default'" style="color: #e6a23c">
                  ℹ️ 首次开启时会请求浏览器通知权限（需要HTTPS或localhost）
                </p>
                <p v-else style="color: #67c23a">
                  ✅ 通知功能已就绪
                </p>
              </div>
              
              <!-- 桌面端提示 -->
              <div v-else-if="!isMobile" style="margin-top: 8px;">
                <p v-if="notificationPermission === 'denied'" style="color: #f56c6c">
                  ⚠️ 浏览器已拒绝通知权限，请在浏览器设置中允许通知权限
                </p>
                <p v-else-if="notificationPermission === 'default'" style="color: #e6a23c">
                  ℹ️ 首次开启时会请求浏览器通知权限
                </p>
                <p v-else style="color: #67c23a">
                  ✅ 通知功能已就绪
                </p>
              </div>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <el-divider />

      <el-card shadow="never" v-if="isCapacitor">
        <template #header>
          <h4>版本信息</h4>
        </template>
        <el-form label-width="120px" style="max-width: 600px">
          <el-form-item label="当前版本">
            <el-input :value="currentVersion" disabled style="width: 200px" />
            <el-button
              type="primary"
              style="margin-left: 10px"
              :loading="checkingUpdate"
              @click="handleCheckUpdate"
            >
              检查更新
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-divider v-if="isCapacitor" />

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
import { 
  isMobileDevice, 
  isIOSDevice, 
  isAndroidDevice, 
  isCapacitorApp, 
  getNotificationPermission,
  isNotificationSupported 
} from '../../utils/device';
import { checkForUpdate, getCurrentVersion } from '../../utils/appUpdate';

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

// 设备信息
const isMobile = computed(() => isMobileDevice());
const isIOS = computed(() => isIOSDevice());
const isAndroid = computed(() => isAndroidDevice());
const isCapacitor = computed(() => isCapacitorApp());

// 浏览器通知权限状态
const notificationPermission = computed(() => getNotificationPermission());

// 版本信息
const currentVersion = ref('1.0.0');
const checkingUpdate = ref(false);

// 获取当前版本
const loadCurrentVersion = async () => {
  if (isCapacitor.value) {
    currentVersion.value = await getCurrentVersion();
  }
};

// 检查更新
const handleCheckUpdate = async () => {
  checkingUpdate.value = true;
  try {
    await checkForUpdate(true);
  } catch (error) {
    console.error('检查更新失败:', error);
  } finally {
    checkingUpdate.value = false;
  }
};

// 通知支持状态
const notificationSupportInfo = computed(() => {
  if (isCapacitor.value) {
    return {
      supported: true,
      message: '已打包为App，使用系统通知',
      needPermission: true,
    };
  }
  
  if (isIOS.value) {
    return {
      supported: false,
      message: 'iOS Safari浏览器不支持Web通知，请使用App版本',
      needPermission: false,
    };
  }
  
  if (isAndroid.value) {
    return {
      supported: isNotificationSupported(),
      message: isNotificationSupported() 
        ? 'Android浏览器支持通知，需要HTTPS或localhost'
        : '当前浏览器不支持通知',
      needPermission: isNotificationSupported(),
    };
  }
  
  // 桌面端
  return {
    supported: isNotificationSupported(),
    message: isNotificationSupported() 
      ? '桌面浏览器支持通知'
      : '当前浏览器不支持通知',
    needPermission: isNotificationSupported(),
  };
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
    // 如果是Capacitor App，直接保存（使用系统通知）
    if (isCapacitor.value) {
      // 保存到后端
      await profileApi.updateProfile({
        notification_enabled: enabled,
      });
      authStore.updateNotificationEnabled(enabled);
      await authStore.fetchCurrentUser();
      ElMessage.success(enabled ? '通知已开启' : '通知已关闭');
      return;
    }

    // iOS Safari不支持Web通知
    if (isIOS.value && !isCapacitor.value) {
      if (enabled) {
        ElMessage.warning('iOS Safari浏览器不支持Web通知，建议使用App版本');
        // 仍然保存设置，但提示用户
        await profileApi.updateProfile({
          notification_enabled: enabled,
        });
        authStore.updateNotificationEnabled(enabled);
        await authStore.fetchCurrentUser();
      } else {
        await profileApi.updateProfile({
          notification_enabled: enabled,
        });
        authStore.updateNotificationEnabled(enabled);
        await authStore.fetchCurrentUser();
        ElMessage.success('通知已关闭');
      }
      return;
    }

    // Android或桌面端：检查浏览器支持
    if (enabled) {
      if (!isNotificationSupported()) {
        ElMessage.warning('您的浏览器不支持通知功能');
        return;
      }

      // 请求权限
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          ElMessage.warning('需要通知权限才能开启通知');
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

    ElMessage.success(enabled ? '通知已开启' : '通知已关闭');
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '更新通知设置失败');
  }
};

// 监听authStore的notificationEnabled变化
watch(() => authStore.notificationEnabled, (newVal) => {
  notificationEnabled.value = newVal;
});

onMounted(async () => {
  // 加载当前版本信息
  if (isCapacitor.value) {
    await loadCurrentVersion();
  }
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

