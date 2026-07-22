<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminToolPanel from '@/views/admin/AdminToolPanel.vue'
import AdminRecordPanel from '@/views/admin/AdminRecordPanel.vue'
import AdminEmployeePanel from '@/views/admin/AdminEmployeePanel.vue'

const router = useRouter()
const route = useRoute()

const activeTab = ref('tools')

const validTabs = ['tools', 'records', 'employees'] as const

const tabFromQuery = computed(() => {
  const tab = route.query.tab
  return typeof tab === 'string' && validTabs.includes(tab as (typeof validTabs)[number])
    ? (tab as (typeof validTabs)[number])
    : 'tools'
})

watch(
  tabFromQuery,
  (tab) => {
    activeTab.value = tab
  },
  { immediate: true },
)

function onTabChange(name: string | number) {
  router.replace({ path: '/admin/data', query: { tab: String(name) } })
}
</script>

<template>
  <div class="page page-touch page-touch--wide">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/admin')">返回管理</el-button>
      <h1 class="page-title">数据更新</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body">
      <el-tabs v-model="activeTab" class="admin-data-tabs" @tab-change="onTabChange">
        <el-tab-pane label="工装表" name="tools">
          <AdminToolPanel />
        </el-tab-pane>
        <el-tab-pane label="借还记录" name="records">
          <AdminRecordPanel />
        </el-tab-pane>
        <el-tab-pane label="员工表" name="employees">
          <AdminEmployeePanel />
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.admin-data-tabs {
  width: 100%;
}

.admin-data-tabs :deep(.el-tabs__content) {
  width: 100%;
}

.admin-data-tabs :deep(.el-tabs__item) {
  font-size: 20px;
  height: 56px;
  line-height: 56px;
  padding: 0 28px;
}
</style>
