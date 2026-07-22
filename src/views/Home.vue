<script setup lang="ts">
import { useRouter } from 'vue-router'
import { isAdminLoggedIn } from '@/composables/useAdminAuth'

const router = useRouter()

const entries = [
  { title: '工装借用', route: '/borrow' },
  { title: '工装归还', route: '/return' },
  { title: '自助入库', route: '/inbound' },
  { title: '库存查询', route: '/stock' },
  { title: '借还记录', route: '/records' },
  { title: '管理员系统', route: '/admin', requireLogin: true },
]

function onEntryClick(entry: (typeof entries)[number]) {
  if (entry.requireLogin && !isAdminLoggedIn()) {
    router.push({ path: '/admin/login', query: { redirect: '/admin' } })
    return
  }
  router.push(entry.route)
}
</script>

<template>
  <div class="page page-home">
    <h1 class="page-title">工装库管理系统</h1>
    <div class="home-grid">
      <button
        v-for="(item, index) in entries"
        :key="item.title"
        type="button"
        class="home-card"
        :class="{ 'home-card--admin': index === 5, 'home-card--inbound': index === 2 }"
        @click="onEntryClick(item)"
      >
        {{ item.title }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-home {
  max-width: none;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 36px 48px 64px;
}

.page-home .page-title {
  text-align: center;
  margin: 0 0 28px;
  font-size: clamp(30px, 4.5vmin, 44px);
  font-weight: 700;
  flex-shrink: 0;
}

.home-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 20px;
  min-height: 0;
}

.home-card {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 16px;
  background: linear-gradient(145deg, #409eff 0%, #337ecc 100%);
  color: #fff;
  font-size: clamp(30px, 5.5vmin, 52px);
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 24px;
  min-height: clamp(120px, 18vmin, 220px);
}

.home-card:active {
  transform: scale(0.98);
  box-shadow: 0 3px 12px rgba(64, 158, 255, 0.3);
}

.home-card--inbound {
  background: linear-gradient(145deg, #67c23a 0%, #529b2e 100%);
  box-shadow: 0 6px 20px rgba(103, 194, 58, 0.35);
}

.home-card--admin {
  background: linear-gradient(145deg, #606266 0%, #45474b 100%);
  box-shadow: 0 6px 20px rgba(96, 98, 102, 0.35);
}
</style>
