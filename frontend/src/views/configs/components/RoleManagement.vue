<template>
  <div class="role-management">
    <div class="header-actions">
      <el-button type="primary" @click="handleCreate">
        <el-icon><Plus /></el-icon>
        创建角色
      </el-button>
    </div>

    <el-table v-loading="loading" :data="roles" stripe style="width: 100%">
      <el-table-column prop="value" label="角色值" width="150" />
      <el-table-column prop="label" label="角色名称" width="200" />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" size="small" link @click="handleEdit(row)">
            编辑
          </el-button>
          <el-button type="danger" size="small" link @click="handleDelete(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
    >
      <el-form :model="form" label-width="100px">
        <el-form-item label="角色值" required>
          <el-input v-model="form.value" placeholder="如：admin" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="角色名称" required>
          <el-input v-model="form.label" placeholder="如：管理员" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { configsApi } from '../../../api/configs';

interface Role {
  value: string;
  label: string;
}

const loading = ref(false);
const roles = ref<Role[]>([]);
const dialogVisible = ref(false);
const isEdit = ref(false);
const dialogTitle = ref('创建角色');
const form = ref<Role>({
  value: '',
  label: '',
});

const loadRoles = async () => {
  loading.value = true;
  try {
    const response = await configsApi.getConfigByKey('roles');
    roles.value = response.config || [];
  } catch (error) {
    ElMessage.error('加载角色列表失败');
  } finally {
    loading.value = false;
  }
};

const handleCreate = () => {
  isEdit.value = false;
  dialogTitle.value = '创建角色';
  form.value = { value: '', label: '' };
  dialogVisible.value = true;
};

const handleEdit = (row: Role) => {
  isEdit.value = true;
  dialogTitle.value = '编辑角色';
  form.value = { ...row };
  dialogVisible.value = true;
};

const handleDelete = async (row: Role) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除角色"${row.label}"吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const updatedRoles = roles.value.filter((r) => r.value !== row.value);
    await configsApi.updateConfig('roles', { config_value: updatedRoles });
    ElMessage.success('删除成功');
    loadRoles();
  } catch (error: any) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败');
    }
  }
};

const handleSubmit = async () => {
  if (!form.value.value || !form.value.label) {
    ElMessage.warning('请填写完整信息');
    return;
  }

  try {
    let updatedRoles: Role[];
    if (isEdit.value) {
      updatedRoles = roles.value.map((r) =>
        r.value === form.value.value ? form.value : r
      );
    } else {
      if (roles.value.some((r) => r.value === form.value.value)) {
        ElMessage.error('角色值已存在');
        return;
      }
      updatedRoles = [...roles.value, form.value];
    }

    await configsApi.updateConfig('roles', { config_value: updatedRoles });
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功');
    dialogVisible.value = false;
    loadRoles();
  } catch (error) {
    ElMessage.error('操作失败');
  }
};

onMounted(() => {
  loadRoles();
});
</script>

<style scoped>
.role-management {
  padding: 20px 0;
}

.header-actions {
  margin-bottom: 20px;
}
</style>

