import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import './index.css'
import { currentUser } from './services/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'register',
      component: () => import('./views/Register.vue'),
      meta: { public: true }
    },
    {
      path: '/menu/:tableId?',
      name: 'menu',
      component: () => import('./views/Menu.vue'),
      meta: { public: true, allowAll: true } // /menu/$tableId can access all users
    },
    {
      path: '/chef',
      name: 'chef',
      component: () => import('./views/Chef.vue'),
      meta: { roles: ['CHEF', 'MANAGER'] }
    },
    {
      path: '/cashier',
      name: 'cashier',
      component: () => import('./views/Cashier.vue'),
      meta: { roles: ['CASHIER', 'MANAGER'] }
    },
    {
      path: '/',
      component: () => import('./layouts/OwnerLayout.vue'),
      children: [
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('./views/Dashboard.vue'),
          meta: { roles: ['MANAGER'] }
        },
        {
          path: 'analytics',
          name: 'analytics',
          component: () => import('./views/Analytics.vue'),
          meta: { roles: ['MANAGER'] }
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('./views/UserManagement.vue'),
          meta: { roles: ['MANAGER'] }
        }
      ]
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// Role-Based Access Control (RBAC) Navigation Guard
router.beforeEach((to, _from, next) => {
  // 1. If route is public or explicitly allows all users (e.g. /menu/:tableId?), permit access immediately
  if (to.meta?.public || to.meta?.allowAll || to.path.startsWith('/menu') || to.path === '/') {
    return next()
  }

  const requiredRoles = to.meta?.roles as string[] | undefined
  if (!requiredRoles || requiredRoles.length === 0) {
    return next()
  }

  // 2. Resolve current user role
  let role: string | null = currentUser.value?.role || null
  if (!role) {
    const userStr = localStorage.getItem('gomeal_auth_user')
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr)
        role = parsed.role
      } catch {
        role = null
      }
    }
  }

  // 3. If unauthenticated, block and redirect to entrance
  if (!role) {
    return next({
      path: '/',
      query: { 
        denied: 'unauthenticated',
        target: to.fullPath
      }
    })
  }

  // 4. Role Authorization Check: MANAGER has full managerial access, others must match required role
  const isAuthorized = requiredRoles.includes(role) || role === 'MANAGER'
  if (isAuthorized) {
    return next()
  }

  // 5. If role is unauthorized, redirect to their role home view
  if (role === 'CHEF') {
    return next({ path: '/chef', query: { denied: 'insufficient_role' } })
  } else if (role === 'CASHIER') {
    return next({ path: '/cashier', query: { denied: 'insufficient_role' } })
  } else {
    // Customer
    const savedTable = localStorage.getItem('gomeal_selected_table') || '01'
    return next({ 
      path: `/menu/${savedTable}`, 
      query: { denied: 'insufficient_role' } 
    })
  }
})

createApp(App).use(router).mount('#root')

