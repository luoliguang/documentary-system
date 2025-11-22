<template>
  <div class="order-activity-timeline">
    <el-divider>
      <span style="font-size: 16px; font-weight: bold;">订单动态</span>
    </el-divider>
    
    <el-timeline v-if="activities.length > 0">
      <el-timeline-item
        v-for="activity in activities"
        :key="activity.id"
        :timestamp="formatTime(activity.created_at)"
        :type="getActivityType(activity.action_type)"
        :icon="getActivityIcon(activity.action_type)"
        placement="top"
      >
        <el-card shadow="hover" :class="{ 'customer-visible': activity.is_visible_to_customer }">
          <div class="activity-header">
            <span class="activity-text">{{ activity.action_text }}</span>
            <el-tag v-if="activity.is_visible_to_customer" type="success" size="small">
              客户可见
            </el-tag>
            <el-tag v-else type="info" size="small">
              内部记录
            </el-tag>
          </div>
          <div v-if="activity.username" class="activity-user">
            <el-icon><User /></el-icon>
            <span>{{ activity.username }}</span>
            <span v-if="activity.user_role" class="user-role">
              ({{ getRoleLabel(activity.user_role) }})
            </span>
          </div>
          <div v-if="activity.extra_data && Object.keys(activity.extra_data).length > 0" class="activity-extra">
            <el-collapse>
              <el-collapse-item title="详细信息" name="details">
                <div class="extra-data-content">
                  <div
                    v-for="(value, key) in activity.extra_data"
                    :key="key"
                    class="extra-data-item"
                  >
                    <span class="extra-data-key">{{ formatKey(key) }}：</span>
                    <span class="extra-data-value">{{ formatValue(key, value) }}</span>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
        </el-card>
      </el-timeline-item>
    </el-timeline>
    
    <el-empty v-else description="暂无操作记录" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { User } from '@element-plus/icons-vue';
import { useAuthStore } from '../../stores/auth';

interface Activity {
  id: number;
  order_id: number;
  user_id: number | null;
  action_type: string;
  action_text: string;
  extra_data: Record<string, any>;
  is_visible_to_customer: boolean;
  created_at: string;
  username?: string;
  user_role?: string;
}

const props = defineProps<{
  activities: Activity[];
}>();

const authStore = useAuthStore();

// 根据用户角色过滤活动
const activities = computed(() => {
  if (authStore.isAdmin || authStore.isProductionManager || authStore.isCustomerService) {
    // 管理员、生产跟单、客服可以看到所有记录
    return props.activities;
  } else {
    // 客户只能看到标记为可见的记录
    return props.activities.filter(a => a.is_visible_to_customer);
  }
});

const formatTime = (time: string) => {
  const date = new Date(time);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getActivityType = (actionType: string): string => {
  const typeMap: Record<string, string> = {
    created: 'primary',
    assigned: 'success',
    status_changed: 'warning',
    updated: 'info',
    note_added: 'info',
    internal_note_added: 'info',
    reminder_replied: 'success',
    completed: 'success',
    can_ship: 'success',
    shipped: 'success',
    follow_up_added: 'primary',
    customer_order_number_updated: 'info',
    estimated_ship_date_updated: 'warning',
    images_updated: 'info',
    tracking_numbers_updated: 'info',
  };
  return typeMap[actionType] || 'info';
};

const getActivityIcon = (actionType: string): string => {
  const iconMap: Record<string, string> = {
    created: 'CircleCheck',
    assigned: 'User',
    status_changed: 'Refresh',
    updated: 'Edit',
    note_added: 'Document',
    internal_note_added: 'Lock',
    reminder_replied: 'ChatDotRound',
    completed: 'Select',
    can_ship: 'Truck',
    shipped: 'Box',
    follow_up_added: 'Message',
    customer_order_number_updated: 'EditPen',
    estimated_ship_date_updated: 'Calendar',
    images_updated: 'Picture',
    tracking_numbers_updated: 'Postcard',
  };
  return iconMap[actionType] || 'InfoFilled';
};

const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    admin: '管理员',
    customer: '客户',
    production_manager: '生产跟单',
    customer_service: '客服',
  };
  return roleMap[role] || role;
};

const formatKey = (key: string): string => {
  const keyMap: Record<string, string> = {
    old_status: '旧状态',
    new_status: '新状态',
    is_completed: '是否完成',
    can_ship: '可出货',
    estimated_ship_date: '预计出货日期',
    notes: '备注',
    internal_notes: '内部备注',
    customer_order_number: '客户订单编号',
    image_count: '图片数量',
    added_count: '新增数量',
    removed_count: '删除数量',
    tracking_count: '发货单号数量',
    assigned_to_ids: '分配人员ID',
    assigned_to_names: '分配人员',
    removed_ids: '移除人员ID',
    follow_up_id: '跟进记录ID',
    content: '内容',
    reminder_id: '催单ID',
    admin_response: '管理员回复',
    is_resolved: '是否已解决',
  };
  return keyMap[key] || key;
};

const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) {
    return '-';
  }
  
  // 处理数组
  if (Array.isArray(value)) {
    if (value.length === 0) return '无';
    return value.join('、');
  }
  
  // 处理对象
  if (typeof value === 'object') {
    return JSON.stringify(value, null, 2);
  }
  
  // 处理布尔值
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  
  // 处理日期
  if (key.includes('date') || key.includes('time') || key.includes('_at')) {
    try {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('zh-CN');
      }
    } catch (e) {
      // 忽略日期解析错误
    }
  }
  
  return String(value);
};
</script>

<style scoped>
.order-activity-timeline {
  margin-top: 0;
}

/* 电脑端：限制高度，支持滚动 */
@media (min-width: 1024px) {
  .order-activity-timeline {
    max-height: calc(100vh - 100px);
    overflow-y: auto;
    padding-right: 8px;
  }

  /* 自定义滚动条样式 */
  .order-activity-timeline::-webkit-scrollbar {
    width: 6px;
  }

  .order-activity-timeline::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 3px;
  }

  .order-activity-timeline::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 3px;
  }

  .order-activity-timeline::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
}

.activity-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.activity-text {
  flex: 1;
  font-weight: 500;
  color: #303133;
}

.activity-user {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}

.user-role {
  color: #909399;
}

.activity-extra {
  margin-top: 8px;
}

.extra-data-content {
  font-size: 13px;
  color: #606266;
  background: #f5f7fa;
  padding: 12px;
  border-radius: 4px;
}

.extra-data-item {
  display: flex;
  margin-bottom: 8px;
  line-height: 1.6;
}

.extra-data-item:last-child {
  margin-bottom: 0;
}

.extra-data-key {
  font-weight: 500;
  color: #303133;
  min-width: 100px;
  flex-shrink: 0;
}

.extra-data-value {
  color: #606266;
  flex: 1;
  word-break: break-word;
}

.customer-visible {
  border-left: 3px solid #67c23a;
}
</style>

