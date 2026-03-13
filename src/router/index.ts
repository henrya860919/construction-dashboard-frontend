import { createRouter, createWebHistory } from 'vue-router'
import { DefaultLayout, AuthLayout } from '@/layouts'
import { ROUTE_NAME, ROUTE_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: ROUTE_PATH.LOGIN,
      component: AuthLayout,
      children: [
        {
          path: '',
          name: ROUTE_NAME.LOGIN,
          component: () => import('@/views/LoginView.vue'),
        },
      ],
    },
    {
      path: ROUTE_PATH.HOME,
      component: DefaultLayout,
      children: [
        { path: '', name: ROUTE_NAME.HOME, redirect: ROUTE_PATH.PROJECTS },
        {
          path: 'projects',
          name: ROUTE_NAME.PROJECTS,
          component: () => import('@/views/ProjectsView.vue'),
        },
        {
          path: 'p/:projectId',
          redirect: (to) => ({ path: `/p/${to.params.projectId}/dashboard` }),
        },
        {
          path: 'p/:projectId/dashboard',
          name: ROUTE_NAME.PROJECT_DASHBOARD,
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'p/:projectId/overview/events',
          name: ROUTE_NAME.PROJECT_OVERVIEW_EVENTS,
          component: () => import('@/views/overview/OverviewEventsView.vue'),
        },
        {
          path: 'p/:projectId/overview/milestones',
          name: ROUTE_NAME.PROJECT_OVERVIEW_MILESTONES,
          component: () => import('@/views/overview/OverviewMilestonesView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/metrics',
          name: ROUTE_NAME.PROJECT_MONITORING_METRICS,
          component: () => import('@/views/monitoring/MonitoringMetricsView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/devices',
          name: ROUTE_NAME.PROJECT_MONITORING_DEVICES,
          component: () => import('@/views/monitoring/MonitoringDevicesView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/devices/:deviceId',
          name: ROUTE_NAME.PROJECT_MONITORING_DEVICE_DETAIL,
          component: () => import('@/views/monitoring/MonitoringDeviceDetailView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/media',
          name: ROUTE_NAME.PROJECT_MONITORING_MEDIA,
          component: () => import('@/views/monitoring/MonitoringMediaView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/reports',
          name: ROUTE_NAME.PROJECT_MONITORING_REPORTS,
          component: () => import('@/views/monitoring/MonitoringReportsView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/upload',
          name: ROUTE_NAME.PROJECT_MONITORING_UPLOAD,
          component: () => import('@/views/monitoring/MonitoringUploadView.vue'),
        },
        {
          path: 'p/:projectId/contract/project-info',
          name: ROUTE_NAME.PROJECT_CONTRACT_PROJECT_INFO,
          component: () => import('@/views/contract/ContractProjectInfoView.vue'),
        },
        {
          path: 'p/:projectId/contract/schedule',
          name: ROUTE_NAME.PROJECT_CONTRACT_SCHEDULE,
          component: () => import('@/views/contract/ContractScheduleView.vue'),
        },
        {
          path: 'p/:projectId/contract/management',
          name: ROUTE_NAME.PROJECT_CONTRACT_MANAGEMENT,
          component: () => import('@/views/contract/ContractManagementView.vue'),
        },
        // 單租後台（共用 DefaultLayout，sidebar 依路由切換為後台選單）
        { path: 'admin', redirect: ROUTE_PATH.ADMIN_PROJECTS },
        {
          path: 'admin/tenant-info',
          name: ROUTE_NAME.ADMIN_TENANT_INFO,
          component: () => import('@/views/admin/AdminTenantInfoView.vue'),
        },
        {
          path: 'admin/projects',
          name: ROUTE_NAME.ADMIN_PROJECTS,
          component: () => import('@/views/admin/AdminProjectsView.vue'),
        },
        {
          path: 'admin/members',
          name: ROUTE_NAME.ADMIN_MEMBERS,
          component: () => import('@/views/admin/AdminMembersView.vue'),
        },
        {
          path: 'admin/settings',
          name: ROUTE_NAME.ADMIN_SETTINGS,
          component: () => import('@/views/admin/AdminSettingsView.vue'),
        },
        // 多租後台（平台方，共用 DefaultLayout，sidebar 依路由切換為平台選單）
        { path: 'platform-admin', redirect: ROUTE_PATH.PLATFORM_ADMIN_TENANTS },
        {
          path: 'platform-admin/tenants',
          name: ROUTE_NAME.PLATFORM_ADMIN_TENANTS,
          component: () => import('@/views/platform-admin/PlatformTenantsView.vue'),
        },
        {
          path: 'platform-admin/tenants/:tenantId',
          name: ROUTE_NAME.PLATFORM_ADMIN_TENANT_MANAGE,
          component: () => import('@/views/platform-admin/PlatformTenantManageView.vue'),
        },
        {
          path: 'platform-admin/projects',
          name: ROUTE_NAME.PLATFORM_ADMIN_PROJECTS,
          component: () => import('@/views/platform-admin/PlatformProjectsView.vue'),
        },
        {
          path: 'platform-admin/users',
          name: ROUTE_NAME.PLATFORM_ADMIN_USERS,
          component: () => import('@/views/platform-admin/PlatformUsersView.vue'),
        },
        {
          path: 'platform-admin/monitoring',
          name: ROUTE_NAME.PLATFORM_ADMIN_MONITORING,
          component: () => import('@/views/platform-admin/PlatformMonitoringView.vue'),
        },
        {
          path: 'platform-admin/monitoring/login-logs',
          name: ROUTE_NAME.PLATFORM_ADMIN_LOGIN_LOGS,
          component: () => import('@/views/platform-admin/PlatformLoginLogsView.vue'),
        },
        {
          path: 'platform-admin/monitoring/audit-logs',
          name: ROUTE_NAME.PLATFORM_ADMIN_AUDIT_LOGS,
          component: () => import('@/views/platform-admin/PlatformAuditLogsView.vue'),
        },
        {
          path: 'platform-admin/usage',
          name: ROUTE_NAME.PLATFORM_ADMIN_USAGE,
          component: () => import('@/views/platform-admin/PlatformUsageView.vue'),
        },
        {
          path: 'platform-admin/announcements',
          name: ROUTE_NAME.PLATFORM_ADMIN_ANNOUNCEMENTS,
          component: () => import('@/views/platform-admin/PlatformAnnouncementsView.vue'),
        },
        {
          path: 'platform-admin/settings',
          name: ROUTE_NAME.PLATFORM_ADMIN_SETTINGS,
          component: () => import('@/views/platform-admin/PlatformSettingsView.vue'),
        },
        {
          path: 'platform-admin/system',
          name: ROUTE_NAME.PLATFORM_ADMIN_SYSTEM,
          component: () => import('@/views/platform-admin/PlatformSystemView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.path === ROUTE_PATH.LOGIN) {
    if (auth.isAuthenticated) {
      next(auth.isPlatformAdmin ? ROUTE_PATH.PLATFORM_ADMIN_TENANTS : ROUTE_PATH.PROJECTS)
    } else {
      next()
    }
    return
  }
  if (!auth.isAuthenticated) {
    next(ROUTE_PATH.LOGIN)
    return
  }
  if (to.path.startsWith('/admin')) {
    if (!auth.canAccessAdmin) {
      next(ROUTE_PATH.PROJECTS)
      return
    }
    if (auth.isPlatformAdmin) {
      next(ROUTE_PATH.PLATFORM_ADMIN_TENANTS)
      return
    }
  }
  if (to.path.startsWith('/platform-admin') && !auth.isPlatformAdmin) {
    next(ROUTE_PATH.PROJECTS)
    return
  }
  next()
})

export default router
