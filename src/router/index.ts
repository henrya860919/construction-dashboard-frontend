import { createRouter, createWebHistory } from 'vue-router'
import { DefaultLayout, AuthLayout, MobileLayout } from '@/layouts'
import { ROUTE_NAME, ROUTE_PATH, buildMobileProjectPath } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useDevice } from '@/composables/useDevice'
import { useAppPreferenceStore } from '@/stores/appPreference'

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
    // 手機版（PWA／現場查驗）— 完全獨立路由與 Layout
        {
          path: ROUTE_PATH.MOBILE,
          component: MobileLayout,
          children: [
            {
              path: '',
              name: ROUTE_NAME.MOBILE_PROJECT_PICKER,
              component: () => import('@/views/mobile/MobileProjectPickerView.vue'),
            },
            {
              path: 'photo-viewer',
              name: ROUTE_NAME.MOBILE_PHOTO_VIEWER,
              component: () => import('@/views/mobile/MobilePhotoViewerView.vue'),
            },
        {
          path: 'p/:projectId',
          redirect: (to) => ({
            path: buildMobileProjectPath(to.params.projectId as string, ROUTE_PATH.MOBILE_INSPECTION),
          }),
        },
        {
          path: 'p/:projectId/inspection/:templateId/records/:recordId',
          name: ROUTE_NAME.MOBILE_INSPECTION_RECORD_DETAIL,
          component: () =>
            import('@/views/mobile/inspection/MobileSelfInspectionRecordDetailView.vue'),
        },
        {
          path: 'p/:projectId/inspection/:templateId/new',
          name: ROUTE_NAME.MOBILE_INSPECTION_RECORD_NEW,
          component: () =>
            import('@/views/mobile/inspection/MobileSelfInspectionRecordNewView.vue'),
        },
        {
          path: 'p/:projectId/inspection/:templateId',
          name: ROUTE_NAME.MOBILE_INSPECTION_TEMPLATE,
          component: () =>
            import('@/views/mobile/inspection/MobileSelfInspectionTemplateView.vue'),
        },
        {
          path: 'p/:projectId/inspection',
          name: ROUTE_NAME.MOBILE_INSPECTION,
          component: () => import('@/views/mobile/MobileInspectionView.vue'),
        },
        {
          path: 'p/:projectId/diary',
          name: ROUTE_NAME.MOBILE_DIARY,
          component: () => import('@/views/mobile/MobileDiaryView.vue'),
        },
        {
          path: 'p/:projectId/defects',
          name: ROUTE_NAME.MOBILE_DEFECTS,
          component: () => import('@/views/mobile/MobileDefectsView.vue'),
        },
        {
          path: 'p/:projectId/defects/new',
          name: ROUTE_NAME.MOBILE_DEFECT_NEW,
          component: () => import('@/views/mobile/defects/MobileDefectNewView.vue'),
        },
        {
          path: 'p/:projectId/defects/:defectId/edit',
          name: ROUTE_NAME.MOBILE_DEFECT_EDIT,
          component: () => import('@/views/mobile/defects/MobileDefectEditView.vue'),
        },
        {
          path: 'p/:projectId/defects/:defectId/records/new',
          name: ROUTE_NAME.MOBILE_DEFECT_RECORD_NEW,
          component: () => import('@/views/mobile/defects/MobileDefectRecordNewView.vue'),
        },
        {
          path: 'p/:projectId/defects/:defectId/records/:recordId',
          name: ROUTE_NAME.MOBILE_DEFECT_RECORD_DETAIL,
          component: () => import('@/views/mobile/defects/MobileDefectRecordDetailView.vue'),
        },
        {
          path: 'p/:projectId/defects/:defectId',
          name: ROUTE_NAME.MOBILE_DEFECT_DETAIL,
          component: () => import('@/views/mobile/defects/MobileDefectDetailView.vue'),
        },
        {
          path: 'p/:projectId/repair/new',
          name: ROUTE_NAME.MOBILE_REPAIR_NEW,
          component: () => import('@/views/mobile/repairs/MobileRepairNewView.vue'),
        },
        {
          path: 'p/:projectId/repair/:repairId/records/new',
          name: ROUTE_NAME.MOBILE_REPAIR_RECORD_NEW,
          component: () => import('@/views/mobile/repairs/MobileRepairRecordNewView.vue'),
        },
        {
          path: 'p/:projectId/repair/:repairId/records/:recordId',
          name: ROUTE_NAME.MOBILE_REPAIR_RECORD_DETAIL,
          component: () => import('@/views/mobile/repairs/MobileRepairRecordDetailView.vue'),
        },
        {
          path: 'p/:projectId/repair/:repairId/edit',
          name: ROUTE_NAME.MOBILE_REPAIR_EDIT,
          component: () => import('@/views/mobile/repairs/MobileRepairEditView.vue'),
        },
        {
          path: 'p/:projectId/repair/:repairId',
          name: ROUTE_NAME.MOBILE_REPAIR_DETAIL,
          component: () => import('@/views/mobile/repairs/MobileRepairDetailView.vue'),
        },
        {
          path: 'p/:projectId/repair',
          name: ROUTE_NAME.MOBILE_REPAIR,
          component: () => import('@/views/mobile/MobileRepairView.vue'),
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
          path: 'p/:projectId/monitoring/history',
          name: ROUTE_NAME.PROJECT_MONITORING_HISTORY,
          component: () => import('@/views/monitoring/MonitoringHistoryView.vue'),
        },
        {
          path: 'p/:projectId/monitoring/metrics',
          redirect: (to) => ({ path: `/p/${to.params.projectId}/monitoring/history`, query: { tab: 'metrics' } }),
        },
        {
          path: 'p/:projectId/monitoring/alerts',
          redirect: (to) => ({ path: `/p/${to.params.projectId}/monitoring/history`, query: { tab: 'alerts' } }),
        },
        {
          path: 'p/:projectId/monitoring/media',
          redirect: (to) => ({ path: `/p/${to.params.projectId}/monitoring/history`, query: { tab: 'media' } }),
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
        {
          path: 'p/:projectId/contract/members',
          name: ROUTE_NAME.PROJECT_MEMBERS,
          component: () => import('@/views/contract/ProjectMembersView.vue'),
        },
        {
          path: 'p/:projectId/files',
          name: ROUTE_NAME.PROJECT_FILES,
          component: () => import('@/views/files/FileManagementView.vue'),
        },
        {
          path: 'p/:projectId/files/forms',
          name: ROUTE_NAME.PROJECT_FILES_FORMS,
          component: () => import('@/views/files/FileFormsView.vue'),
        },
        {
          path: 'p/:projectId/files/photos',
          name: ROUTE_NAME.PROJECT_FILES_PHOTOS,
          component: () => import('@/views/files/FilePhotosView.vue'),
        },
        {
          path: 'p/:projectId/management/wbs',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_WBS,
          component: () => import('@/views/management/ManagementWbsView.vue'),
        },
        {
          path: 'p/:projectId/management/resources',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_RESOURCES,
          component: () => import('@/views/management/ManagementResourcesView.vue'),
        },
        {
          path: 'p/:projectId/management/risks',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_RISKS,
          component: () => import('@/views/management/ManagementRisksView.vue'),
        },
        {
          path: 'p/:projectId/management/schedule',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_SCHEDULE,
          component: () => import('@/views/management/ManagementScheduleView.vue'),
        },
        {
          path: 'p/:projectId/management/gantt',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_GANTT,
          component: () => import('@/views/management/ManagementGanttView.vue'),
        },
        {
          path: 'p/:projectId/management/overview',
          name: ROUTE_NAME.PROJECT_MANAGEMENT_OVERVIEW,
          component: () => import('@/views/management/ManagementOverviewView.vue'),
        },
        {
          path: 'p/:projectId/construction/self-check/:templateId/records/:recordId',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_RECORD,
          component: () => import('@/views/construction/ConstructionSelfCheckRecordDetailView.vue'),
        },
        {
          path: 'p/:projectId/construction/self-check/:templateId/new',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_NEW,
          component: () => import('@/views/construction/ConstructionSelfCheckRecordNewView.vue'),
        },
        {
          path: 'p/:projectId/construction/self-check/:templateId',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE,
          component: () => import('@/views/construction/ConstructionSelfCheckTemplateView.vue'),
        },
        {
          path: 'p/:projectId/construction/self-check',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK,
          component: () => import('@/views/construction/ConstructionSelfCheckView.vue'),
        },
        {
          path: 'p/:projectId/construction/diary',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_DIARY,
          component: () => import('@/views/construction/ConstructionDiaryView.vue'),
        },
        {
          path: 'p/:projectId/construction/drawings',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_DRAWINGS,
          component: () => import('@/views/construction/ConstructionDrawingsView.vue'),
        },
        {
          path: 'p/:projectId/construction/defects/:defectId',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_DEFECT_DETAIL,
          component: () => import('@/views/construction/ConstructionDefectDetailView.vue'),
        },
        {
          path: 'p/:projectId/construction/defects',
          name: ROUTE_NAME.PROJECT_CONSTRUCTION_DEFECTS,
          component: () => import('@/views/construction/ConstructionDefectsView.vue'),
        },
        {
          path: 'p/:projectId/repair/overview',
          name: ROUTE_NAME.PROJECT_REPAIR_OVERVIEW,
          component: () => import('@/views/repair/RepairOverviewView.vue'),
        },
        {
          path: 'p/:projectId/repair/records',
          name: ROUTE_NAME.PROJECT_REPAIR_RECORDS,
          component: () => import('@/views/repair/RepairRecordsView.vue'),
        },
        {
          path: 'p/:projectId/repair/records/:repairId',
          name: ROUTE_NAME.PROJECT_REPAIR_RECORD_DETAIL,
          component: () => import('@/views/repair/RepairRecordDetailView.vue'),
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
          path: 'admin/form-templates',
          name: ROUTE_NAME.ADMIN_FORM_TEMPLATES,
          component: () => import('@/views/admin/AdminFormTemplatesView.vue'),
        },
        {
          path: 'admin/self-inspection-templates',
          name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATES,
          component: () => import('@/views/admin/AdminSelfInspectionTemplatesView.vue'),
        },
        {
          path: 'admin/self-inspection-templates/:templateId',
          name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL,
          component: () => import('@/views/admin/AdminSelfInspectionTemplateDetailView.vue'),
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
  const { isMobileApp } = useDevice()
  const appPreference = useAppPreferenceStore()

  if (to.path === ROUTE_PATH.LOGIN) {
    if (auth.isAuthenticated) {
      if (isMobileApp.value && !appPreference.preferDesktopOnMobile) {
        next(ROUTE_PATH.MOBILE)
      } else {
        next(auth.isPlatformAdmin ? ROUTE_PATH.PLATFORM_ADMIN_TENANTS : ROUTE_PATH.PROJECTS)
      }
    } else {
      next()
    }
    return
  }
  if (!auth.isAuthenticated) {
    next(ROUTE_PATH.LOGIN)
    return
  }
  // 手機版路由：桌面裝置誤入則導回專案列表
  if (to.path.startsWith(ROUTE_PATH.MOBILE)) {
    if (!isMobileApp.value) {
      next(ROUTE_PATH.PROJECTS)
      return
    }
    next()
    return
  }
  // 手機／PWA 且未選擇「使用桌面版」→ 導向手機版
  if (isMobileApp.value && !appPreference.preferDesktopOnMobile) {
    next(ROUTE_PATH.MOBILE)
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
