import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { ordersApi } from '../api/orders';
import type { CustomerCompany } from '../types';

const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;

interface FetchOptions {
  search?: string;
  force?: boolean;
}

export const useCustomerCompaniesStore = defineStore('customerCompanies', () => {
  const companies = ref<CustomerCompany[]>([]);
  const lastFetchedAt = ref<number | null>(null);
  const loading = ref(false);

  const isStale = computed(() => {
    if (!lastFetchedAt.value) {
      return true;
    }
    return Date.now() - lastFetchedAt.value > DEFAULT_CACHE_TTL_MS;
  });

  const fetchCompanies = async (options?: FetchOptions) => {
    const { search, force = false } = options ?? {};
    const shouldUseCache = !search && !force && !isStale.value && companies.value.length > 0;
    if (shouldUseCache) {
      return companies.value;
    }

    if (!search) {
      loading.value = true;
    }

    try {
      const response = await ordersApi.getCustomerCompanies(
        search ? { search } : undefined,
        { force }
      );
      if (!search) {
        companies.value = response.companies;
        lastFetchedAt.value = Date.now();
      }
      return response.companies;
    } finally {
      if (!search) {
        loading.value = false;
      }
    }
  };

  const invalidate = () => {
    companies.value = [];
    lastFetchedAt.value = null;
  };

  const refresh = async () => {
    invalidate();
    return fetchCompanies({ force: true });
  };

  return {
    companies,
    loading,
    isStale,
    fetchCompanies,
    invalidate,
    refresh,
  };
});

