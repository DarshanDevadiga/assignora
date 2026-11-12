/**
 * Shared route chunk loaders and hover/idle prefetch helpers.
 * Keeps React.lazy factories and route prefetching synchronized in one place.
 */

export const routeLoaders = {
  // Layouts & Auth
  DashboardLayout: () => import('../components/layout/DashboardLayout'),
  Login: () => import('../pages/Login'),
  Register: () => import('../pages/Register'),
  AuthCallback: () => import('../pages/AuthCallback'),
  LandingPage: () => import('../pages/LandingPage'),
  JoinClassPage: () => import('../pages/shared/JoinClassPage'),
  NotFound: () => import('../pages/shared/NotFound'),

  // Admin / Professor pages
  AdminDashboard: () => import('../pages/admin/AdminDashboard'),
  ClassesManagement: () => import('../pages/admin/ClassesManagement'),
  StudentsManagement: () => import('../pages/admin/StudentsManagement'),
  AssignmentsList: () => import('../pages/admin/AssignmentsList'),
  CreateAssignment: () => import('../pages/admin/CreateAssignment'),
  SubmissionTracking: () => import('../pages/admin/SubmissionTracking'),
  GradesGradebook: () => import('../pages/admin/GradesGradebook'),
  AnnouncementsManagement: () => import('../pages/admin/AnnouncementsManagement'),

  // Student pages
  StudentDashboard: () => import('../pages/student/StudentDashboard'),
  AssignmentDetails: () => import('../pages/student/AssignmentDetails'),
  StudentSubmissions: () => import('../pages/student/StudentSubmissions'),
  StudentAnnouncements: () => import('../pages/student/StudentAnnouncements'),

  // Shared detail & utility pages
  ClassDetailPage: () => import('../pages/shared/ClassDetailPage'),
  GroupDetailsPage: () => import('../pages/shared/GroupDetailsPage'),
  SettingsPage: () => import('../pages/shared/SettingsPage'),
  ProfilePage: () => import('../pages/shared/ProfilePage'),
}

const prefetchedLoaders = new Set()

function triggerLoader(loader) {
  if (!loader || prefetchedLoaders.has(loader)) return
  prefetchedLoaders.add(loader)
  Promise.resolve()
    .then(() => loader())
    .catch(() => {
      prefetchedLoaders.delete(loader)
    })
}

/**
 * Prefetch a route module by pathname prefix before navigation occurs.
 */
export function prefetchRoute(pathname) {
  if (!pathname || typeof window === 'undefined') return

  if (pathname === '/login') return triggerLoader(routeLoaders.Login)
  if (pathname === '/register') return triggerLoader(routeLoaders.Register)

  if (pathname === '/admin') return triggerLoader(routeLoaders.AdminDashboard)
  if (pathname === '/admin/classes') return triggerLoader(routeLoaders.ClassesManagement)
  if (pathname.startsWith('/admin/classes/') && pathname.includes('/groups/')) {
    return triggerLoader(routeLoaders.GroupDetailsPage)
  }
  if (pathname.startsWith('/admin/classes/')) return triggerLoader(routeLoaders.ClassDetailPage)
  if (pathname === '/admin/assignments/create' || pathname.endsWith('/edit')) {
    return triggerLoader(routeLoaders.CreateAssignment)
  }
  if (pathname.startsWith('/admin/assignments/')) return triggerLoader(routeLoaders.SubmissionTracking)
  if (pathname === '/admin/assignments') return triggerLoader(routeLoaders.AssignmentsList)
  if (pathname === '/admin/students') return triggerLoader(routeLoaders.StudentsManagement)
  if (pathname === '/admin/announcements') return triggerLoader(routeLoaders.AnnouncementsManagement)
  if (pathname === '/admin/grades' || pathname === '/admin/reports') {
    return triggerLoader(routeLoaders.GradesGradebook)
  }
  if (pathname === '/admin/profile') return triggerLoader(routeLoaders.ProfilePage)
  if (pathname === '/admin/settings') return triggerLoader(routeLoaders.SettingsPage)

  if (pathname === '/student') return triggerLoader(routeLoaders.StudentDashboard)
  if (pathname === '/student/classes') return triggerLoader(routeLoaders.ClassesManagement)
  if (pathname.startsWith('/student/classes/') && pathname.includes('/groups/')) {
    return triggerLoader(routeLoaders.GroupDetailsPage)
  }
  if (pathname.startsWith('/student/classes/')) return triggerLoader(routeLoaders.ClassDetailPage)
  if (pathname.startsWith('/student/assignments/')) return triggerLoader(routeLoaders.AssignmentDetails)
  if (pathname === '/student/submissions') return triggerLoader(routeLoaders.StudentSubmissions)
  if (pathname === '/student/announcements') return triggerLoader(routeLoaders.StudentAnnouncements)
  if (pathname === '/student/profile') return triggerLoader(routeLoaders.ProfilePage)
  if (pathname === '/student/settings') return triggerLoader(routeLoaders.SettingsPage)
}

/**
 * Prefetch high-probability secondary routes during browser idle time for a role.
 */
export function prefetchRoleCoreRoutes(role) {
  if (typeof window === 'undefined' || !role) return

  const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 800))
  scheduleIdle(() => {
    if (role === 'admin') {
      triggerLoader(routeLoaders.ClassesManagement)
      triggerLoader(routeLoaders.AssignmentsList)
      triggerLoader(routeLoaders.ClassDetailPage)
    } else if (role === 'student') {
      triggerLoader(routeLoaders.ClassesManagement)
      triggerLoader(routeLoaders.ClassDetailPage)
      triggerLoader(routeLoaders.AssignmentDetails)
    }
  })
}
