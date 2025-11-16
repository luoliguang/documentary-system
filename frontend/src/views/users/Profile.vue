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
import { ref, reactive, onMounted } from 'vue';
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
  ],
  confirm_password: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (rule: any, value: any, callback: any) => {
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
      ElMessage.error(error.response?.data?.error || '修改密码失败');
    }
  });
};

onMounted(() => {
  loadProfile();
});
</script>

<style scoped>
.profile {
  width: 100%;
}
</style>

