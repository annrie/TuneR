import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/Home.vue'),
  },
  {
    path: '/favorites',
    name: 'favorites',
    component: () => import('../views/Favorites.vue'),
  },
]

const router = createRouter({
  // Tauri requires hash mode (custom protocol can't handle history mode)
  history: createWebHashHistory(),
  routes,
})

export default router
