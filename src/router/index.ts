import { createRouter, createWebHistory } from 'vue-router'
import { DefaultLayout } from '@/layouts'
import { ROUTE_NAME, ROUTE_PATH } from '@/constants'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: ROUTE_PATH.HOME,
      component: DefaultLayout,
      children: [
        {
          path: '',
          name: ROUTE_NAME.HOME,
          component: () => import('@/views/HomeView.vue'),
        },
      ],
    },
  ],
})

export default router
