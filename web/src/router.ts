import { createRouter, createWebHistory } from 'vue-router'
import { refresh, session } from './api'
import AppShell from './components/AppShell.vue'

let booted = false

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: () => import('./views/Login.vue'), meta: { public: true } },
    {
      path: '/',
      component: AppShell,
      children: [
        { path: '', component: () => import('./views/Overview.vue') },
        { path: 'users', component: () => import('./views/Users.vue') },
        { path: 'staff', component: () => import('./views/Staff.vue') },
        { path: 'account', component: () => import('./views/Account.vue') },
      ],
    },
    { path: '/:rest(.*)*', redirect: '/' },
  ],
  scrollBehavior: (to) => (to.hash ? { el: to.hash, top: 16, behavior: 'smooth' } : { top: 0 }),
})

router.beforeEach(async (to) => {
  if (!booted) {
    booted = true
    await refresh()
  }
  if (to.meta.public) return session.me ? '/' : true
  if (!session.me) return '/login'
  if (session.me.mustChangePassword && to.path !== '/account') return '/account'
  return true
})
