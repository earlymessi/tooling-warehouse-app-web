import { createRouter, createWebHashHistory } from 'vue-router'
import { isAdminLoggedIn } from '@/composables/useAdminAuth'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/Home.vue') },
    { path: '/borrow', name: 'borrow', component: () => import('@/views/Borrow.vue') },
    { path: '/return', name: 'return', component: () => import('@/views/Return.vue') },
    { path: '/inbound', name: 'inbound', component: () => import('@/views/Inbound.vue') },
    { path: '/stock', name: 'stock', component: () => import('@/views/StockQuery.vue') },
    { path: '/records', name: 'records', component: () => import('@/views/RecordList.vue') },
    { path: '/admin/login', name: 'admin-login', component: () => import('@/views/AdminLogin.vue') },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('@/views/AdminHub.vue'),
      meta: { requiresAdmin: true },
    },
    {
      path: '/admin/data',
      name: 'admin-data',
      component: () => import('@/views/AdminData.vue'),
      meta: { requiresAdmin: true, adminMode: true },
    },
    {
      path: '/admin/tools',
      name: 'admin-tools',
      component: () => import('@/views/ToolList.vue'),
      meta: { requiresAdmin: true, adminMode: true },
    },
    {
      path: '/admin/tools/new',
      name: 'admin-tool-new',
      component: () => import('@/views/ToolForm.vue'),
      meta: { requiresAdmin: true, adminMode: true },
    },
    {
      path: '/admin/tools/:id/edit',
      name: 'admin-tool-edit',
      component: () => import('@/views/ToolForm.vue'),
      props: true,
      meta: { requiresAdmin: true, adminMode: true },
    },
    {
      path: '/admin/settings',
      name: 'admin-settings',
      component: () => import('@/views/Settings.vue'),
      meta: { requiresAdmin: true, adminMode: true },
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAdmin && !isAdminLoggedIn()) {
    return { path: '/admin/login', query: { redirect: to.fullPath } }
  }
  if (to.path === '/admin/login' && isAdminLoggedIn()) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : '/admin'
    return redirect
  }
  return true
})

export default router
