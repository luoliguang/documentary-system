import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { DeliveryReminder } from '../types';
import { remindersApi } from '../api/reminders';
import { connectWebSocket } from '../utils/websocket';

type ReminderQuery = {
  order_id?: number;
  order_number?: string;
  customer_order_number?: string;
  company_name?: string;
  reminder_type?: 'normal' | 'urgent';
  is_resolved?: boolean;
  start_date?: string;
  end_date?: string;
};

export const useRemindersStore = defineStore(
  'reminders',
  () => {
    const reminders = ref<DeliveryReminder[]>([]);
    const loading = ref(false);
    const lastQueryKey = ref<string | null>(null);
    const handlerRef = ref<((data: any) => void) | null>(null);
    const isLoading = computed(() => loading.value);

    const serializeParams = (params?: ReminderQuery) =>
      JSON.stringify(params ? Object.entries(params).sort() : []);

    const upsertReminder = (reminder: DeliveryReminder) => {
      if (!reminder) return;
      const index = reminders.value.findIndex((item) => item.id === reminder.id);
      if (index >= 0) {
        reminders.value[index] = { ...reminders.value[index], ...reminder };
      } else {
        reminders.value.unshift(reminder);
      }
    };

    const removeReminder = (id: number) => {
      reminders.value = reminders.value.filter((item) => item.id !== id);
    };

    const fetchReminders = async (
      params?: ReminderQuery,
      options: { force?: boolean } = {}
    ) => {
      const queryKey = serializeParams(params);
      if (!options.force) {
        if (loading.value) {
          return reminders.value;
        }
        if (reminders.value.length > 0 && lastQueryKey.value === queryKey) {
          return reminders.value;
        }
      }
      loading.value = true;
      try {
        const response = await remindersApi.getDeliveryReminders(params);
        reminders.value = response.reminders;
        lastQueryKey.value = queryKey;
        return response.reminders;
      } finally {
        loading.value = false;
      }
    };

    const initRealtime = () => {
      if (handlerRef.value) return;
      handlerRef.value = (payload: any) => {
        if (payload.type === 'reminder-updated' && payload.reminder) {
          upsertReminder(payload.reminder);
        }
        if (payload.type === 'reminder-removed' && payload.reminderId) {
          removeReminder(payload.reminderId);
        }
      };
      connectWebSocket((data) => {
        handlerRef.value?.(data);
      });
    };

    return {
      reminders,
      loading,
      isLoading,
      lastQueryKey,
      fetchReminders,
      upsertReminder,
      removeReminder,
      initRealtime,
    };
  },
  {
    persist: {
      key: 'reminders-store',
      paths: ['reminders', 'lastQueryKey'],
      ttl: 5 * 60 * 1000,
    },
  }
);


