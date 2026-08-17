<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { t, currentLang } from '../i18n'
import { userService, ManagedUser, UserStats, UserRole, UserStatus } from '../services/users'
import { currentUser } from '../services/auth'

// Loading & UI State
const isLoading = ref(true)
const isSubmitting = ref(false)
const users = ref<ManagedUser[]>([])
const stats = ref<UserStats>({
  total: 0,
  active: 0,
  inactive: 0,
  managers: 0,
  cashiers: 0,
  chefs: 0,
  customers: 0
})

// Search & Filtering State
const searchQuery = ref('')
const selectedRole = ref<string>('ALL')
const selectedStatus = ref<string>('ALL')
const sortBy = ref<'name' | 'createdAt' | 'role'>('createdAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Toast Alert Notification
interface Toast {
  id: number
  type: 'success' | 'error' | 'info'
  message: string
}
const toasts = ref<Toast[]>([])
const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const id = Date.now()
  toasts.value.push({ id, type, message })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, 4000)
}

// Modal States
const showAddModal = ref(false)
const showEditModal = ref(false)
const showDeleteModal = ref(false)
const showResetModal = ref(false)

// Form Models
const userForm = ref<{
  id?: number
  name: string
  email: string
  password: string
  role: UserRole
  status: UserStatus
  phone: string
}>({
  name: '',
  email: '',
  password: '',
  role: 'CASHIER',
  status: 'ACTIVE',
  phone: ''
})

const resetPasswordForm = ref<{
  id: number
  name: string
  email: string
  newPassword: string
}>({
  id: 0,
  name: '',
  email: '',
  newPassword: ''
})

const userToDelete = ref<ManagedUser | null>(null)
const formError = ref('')
const showFormPassword = ref(false)
const showResetPasswordToggle = ref(false)

// Fetch Users and Stats
const fetchUsers = async () => {
  isLoading.value = true
  try {
    const data = await userService.getUsers({
      search: searchQuery.value,
      role: selectedRole.value,
      status: selectedStatus.value
    })
    users.value = data.users
    stats.value = data.stats
  } catch (err: any) {
    showToast(err.message || 'Failed to load user records', 'error')
  } finally {
    isLoading.value = false
  }
}

// Debounced Search Handler
let searchTimeout: any = null
watch(searchQuery, () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    fetchUsers()
  }, 300)
})

watch([selectedRole, selectedStatus], () => {
  fetchUsers()
})

onMounted(() => {
  fetchUsers()
})

// Filtered & Sorted Users Computed
const processedUsers = computed(() => {
  let list = [...users.value]

  // Sorting
  list.sort((a, b) => {
    let comp = 0
    if (sortBy.value === 'name') {
      comp = a.name.localeCompare(b.name)
    } else if (sortBy.value === 'role') {
      comp = a.role.localeCompare(b.role)
    } else {
      // Date created
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      comp = dateA - dateB
    }
    return sortOrder.value === 'asc' ? comp : -comp
  })

  return list
})

// Role styling helpers
const getRoleBadgeClass = (role: UserRole) => {
  switch (role) {
    case 'MANAGER':
      return 'bg-purple-100 text-purple-800 border-purple-200'
    case 'CASHIER':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'CHEF':
      return 'bg-amber-100 text-amber-800 border-amber-200'
    case 'CUSTOMER':
      return 'bg-slate-100 text-slate-700 border-slate-200'
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

const getRoleIcon = (role: UserRole) => {
  switch (role) {
    case 'MANAGER':
      return 'admin_panel_settings'
    case 'CASHIER':
      return 'point_of_sale'
    case 'CHEF':
      return 'restaurant'
    case 'CUSTOMER':
      return 'person'
    default:
      return 'badge'
  }
}

const getRoleLabel = (role: UserRole) => {
  switch (role) {
    case 'MANAGER':
      return t('userRoleManager')
    case 'CASHIER':
      return t('userRoleCashier')
    case 'CHEF':
      return t('userRoleChef')
    case 'CUSTOMER':
      return t('userRoleCustomer')
    default:
      return role
  }
}

const getInitials = (name: string) => {
  if (!name) return 'U'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return currentLang.value === 'km' ? 'មិនទាន់មាន' : 'N/A'
  const d = new Date(dateStr)
  return d.toLocaleDateString(currentLang.value === 'km' ? 'km-KH' : 'en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// Action Handlers
const openAddModal = () => {
  formError.value = ''
  showFormPassword.value = false
  userForm.value = {
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    status: 'ACTIVE',
    phone: ''
  }
  showAddModal.value = true
}

const openEditModal = (user: ManagedUser) => {
  formError.value = ''
  showFormPassword.value = false
  userForm.value = {
    id: user.id,
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    status: user.status,
    phone: user.phone || ''
  }
  showEditModal.value = true
}

const openResetModal = (user: ManagedUser) => {
  formError.value = ''
  showResetPasswordToggle.value = false
  resetPasswordForm.value = {
    id: user.id,
    name: user.name,
    email: user.email,
    newPassword: ''
  }
  showResetModal.value = true
}

const openDeleteModal = (user: ManagedUser) => {
  userToDelete.value = user
  showDeleteModal.value = true
}

// Handle Form Submissions
const handleCreateUser = async () => {
  formError.value = ''
  if (!userForm.value.name.trim()) {
    formError.value = currentLang.value === 'km' ? 'សូមបញ្ចូលឈ្មោះពេញ' : 'Full name is required'
    return
  }
  if (!userForm.value.email.trim()) {
    formError.value = currentLang.value === 'km' ? 'សូមបញ្ចូលអ៊ីមែល' : 'Email address is required'
    return
  }
  if (!userForm.value.password || userForm.value.password.length < 4) {
    formError.value = currentLang.value === 'km' ? 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួ' : 'Password must be at least 4 characters'
    return
  }

  isSubmitting.value = true
  try {
    await userService.createUser({
      name: userForm.value.name.trim(),
      email: userForm.value.email.trim(),
      password: userForm.value.password,
      role: userForm.value.role,
      status: userForm.value.status,
      phone: userForm.value.phone.trim() || undefined
    })

    showAddModal.value = false
    showToast(t('userCreatedSuccess'), 'success')
    await fetchUsers()
  } catch (err: any) {
    formError.value = err.message || 'Failed to create user'
  } finally {
    isSubmitting.value = false
  }
}

const handleUpdateUser = async () => {
  if (!userForm.value.id) return
  formError.value = ''

  if (!userForm.value.name.trim()) {
    formError.value = currentLang.value === 'km' ? 'សូមបញ្ចូលឈ្មោះពេញ' : 'Full name is required'
    return
  }
  if (!userForm.value.email.trim()) {
    formError.value = currentLang.value === 'km' ? 'សូមបញ្ចូលអ៊ីមែល' : 'Email address is required'
    return
  }
  if (userForm.value.password && userForm.value.password.length < 4) {
    formError.value = currentLang.value === 'km' ? 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួ' : 'Password must be at least 4 characters'
    return
  }

  isSubmitting.value = true
  try {
    await userService.updateUser(userForm.value.id, {
      name: userForm.value.name.trim(),
      email: userForm.value.email.trim(),
      role: userForm.value.role,
      status: userForm.value.status,
      phone: userForm.value.phone.trim() || undefined,
      password: userForm.value.password ? userForm.value.password : undefined
    })

    showEditModal.value = false
    showToast(t('userUpdatedSuccess'), 'success')
    await fetchUsers()
  } catch (err: any) {
    formError.value = err.message || 'Failed to update user'
  } finally {
    isSubmitting.value = false
  }
}

const handleToggleStatus = async (user: ManagedUser) => {
  // Safety checks
  if (currentUser.value && user.id === currentUser.value.id) {
    showToast(currentLang.value === 'km' ? 'អ្នកមិនអាចបិទដំណើរការគណនីផ្ទាល់ខ្លួនបានទេ!' : 'You cannot deactivate your own account!', 'error')
    return
  }

  const nextStatus: UserStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  try {
    await userService.toggleStatus(user.id, nextStatus)
    user.status = nextStatus
    showToast(t('userStatusToggledSuccess'), 'success')
    // Refresh stats summary
    const data = await userService.getUsers({
      search: searchQuery.value,
      role: selectedRole.value,
      status: selectedStatus.value
    })
    stats.value = data.stats
  } catch (err: any) {
    showToast(err.message || 'Failed to change status', 'error')
  }
}

const handleResetPassword = async () => {
  if (!resetPasswordForm.value.id) return
  formError.value = ''

  if (!resetPasswordForm.value.newPassword || resetPasswordForm.value.newPassword.length < 4) {
    formError.value = currentLang.value === 'km' ? 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ៤ តួ' : 'New password must be at least 4 characters'
    return
  }

  isSubmitting.value = true
  try {
    await userService.resetPassword(resetPasswordForm.value.id, resetPasswordForm.value.newPassword)
    showResetModal.value = false
    showToast(t('passwordResetSuccess'), 'success')
  } catch (err: any) {
    formError.value = err.message || 'Failed to reset password'
  } finally {
    isSubmitting.value = false
  }
}

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$'
  let pass = ''
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  resetPasswordForm.value.newPassword = pass
  showResetPasswordToggle.value = true
}

const handleDeleteUser = async () => {
  if (!userToDelete.value) return

  isSubmitting.value = true
  try {
    await userService.deleteUser(userToDelete.value.id)
    showDeleteModal.value = false
    showToast(t('userDeletedSuccess'), 'success')
    userToDelete.value = null
    await fetchUsers()
  } catch (err: any) {
    showToast(err.message || 'Failed to delete user', 'error')
  } finally {
    isSubmitting.value = false
  }
}

const isSelf = (user: ManagedUser): boolean => {
  return Boolean(currentUser.value && user.id === currentUser.value.id)
}
</script>

<template>
  <div class="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
    <!-- Header Section -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <span class="p-2.5 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">manage_accounts</span>
          </span>
          <h1 class="text-2xl md:text-3xl font-black text-on-surface tracking-tight">{{ t('userManagement') }}</h1>
        </div>
        <p class="text-sm text-on-surface-variant font-medium">{{ t('userManagementSubtitle') }}</p>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-3 shrink-0">
        <button
          @click="fetchUsers"
          class="p-2.5 text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-xl border border-outline-variant transition-all cursor-pointer flex items-center justify-center"
          :title="currentLang === 'km' ? 'ផ្ទុកឡើងវិញ' : 'Refresh List'"
        >
          <span class="material-symbols-outlined text-xl" :class="{ 'animate-spin': isLoading }">refresh</span>
        </button>

        <button
          id="btn-add-user"
          @click="openAddModal"
          class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-sm rounded-xl shadow-md shadow-primary/20 hover:shadow-lg transition-all duration-150 flex items-center gap-2 cursor-pointer active:scale-98"
        >
          <span class="material-symbols-outlined text-lg">person_add</span>
          <span>{{ t('addNewUser') }}</span>
        </button>
      </div>
    </header>

    <!-- KPI Metric Cards Grid -->
    <section class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
      <!-- Total Users -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('totalUsersCount') }}</span>
          <span class="material-symbols-outlined text-lg text-primary">groups</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-on-surface">{{ stats.total }}</span>
          <span class="text-[11px] font-bold text-emerald-600">100%</span>
        </div>
      </div>

      <!-- Active Staff -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('activeStaffCount') }}</span>
          <span class="material-symbols-outlined text-lg text-emerald-600">check_circle</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-emerald-700">{{ stats.active }}</span>
          <span class="text-[11px] font-medium text-on-surface-variant">/ {{ stats.total }}</span>
        </div>
      </div>

      <!-- Managers -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('userRoleManager') }}</span>
          <span class="material-symbols-outlined text-lg text-purple-600">admin_panel_settings</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-purple-700">{{ stats.managers }}</span>
          <span class="text-[11px] font-bold text-purple-500">Staff</span>
        </div>
      </div>

      <!-- Cashiers -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('userRoleCashier') }}</span>
          <span class="material-symbols-outlined text-lg text-blue-600">point_of_sale</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-blue-700">{{ stats.cashiers }}</span>
          <span class="text-[11px] font-bold text-blue-500">Staff</span>
        </div>
      </div>

      <!-- Chefs -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('userRoleChef') }}</span>
          <span class="material-symbols-outlined text-lg text-amber-600">restaurant</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-amber-700">{{ stats.chefs }}</span>
          <span class="text-[11px] font-bold text-amber-500">Staff</span>
        </div>
      </div>

      <!-- Customers -->
      <div class="p-4 bg-white rounded-2xl border border-outline-variant shadow-xs flex flex-col justify-between">
        <div class="flex items-center justify-between text-on-surface-variant mb-2">
          <span class="text-xs font-bold uppercase tracking-wider">{{ t('userRoleCustomer') }}</span>
          <span class="material-symbols-outlined text-lg text-slate-600">person</span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-2xl font-black text-slate-700">{{ stats.customers }}</span>
          <span class="text-[11px] font-bold text-slate-500">Guests</span>
        </div>
      </div>
    </section>

    <!-- Filter & Search Toolbar -->
    <section class="bg-white p-4 md:p-5 rounded-2xl border border-outline-variant shadow-xs space-y-4">
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1">
          <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('searchUsersPlaceholder')"
            class="w-full pl-10 pr-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
          />
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-1 rounded-md"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <!-- Role Filter Selector -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <button
            v-for="roleOption in [
              { key: 'ALL', label: t('allRoles') },
              { key: 'MANAGER', label: t('userRoleManager') },
              { key: 'CASHIER', label: t('userRoleCashier') },
              { key: 'CHEF', label: t('userRoleChef') },
              { key: 'CUSTOMER', label: t('userRoleCustomer') }
            ]"
            :key="roleOption.key"
            @click="selectedRole = roleOption.key"
            class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border"
            :class="selectedRole === roleOption.key 
              ? 'bg-primary text-white border-primary shadow-xs' 
              : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container'"
          >
            {{ roleOption.label }}
          </button>
        </div>

        <!-- Status Filter Dropdown -->
        <div class="flex items-center gap-2">
          <select
            v-model="selectedStatus"
            class="px-3 py-2 bg-surface-container rounded-xl text-xs font-bold border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none text-on-surface cursor-pointer"
          >
            <option value="ALL">{{ t('allStatuses') }}</option>
            <option value="ACTIVE">{{ t('statusActive') }}</option>
            <option value="INACTIVE">{{ t('statusInactive') }}</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Users Table / List Section -->
    <section class="bg-white rounded-2xl border border-outline-variant shadow-xs overflow-hidden">
      <!-- Loading State Indicator -->
      <div v-if="isLoading" class="py-16 flex flex-col items-center justify-center gap-3 text-on-surface-variant">
        <span class="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>
        <p class="text-sm font-semibold">{{ currentLang === 'km' ? 'កំពុងទាញយកទិន្នន័យ...' : 'Loading user directory...' }}</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="processedUsers.length === 0" class="py-16 px-6 text-center">
        <div class="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4 text-on-surface-variant">
          <span class="material-symbols-outlined text-3xl">person_search</span>
        </div>
        <h3 class="text-lg font-bold text-on-surface mb-1">{{ t('noUsersFoundTitle') }}</h3>
        <p class="text-sm text-on-surface-variant max-w-md mx-auto mb-6">{{ t('noUsersFoundDesc') }}</p>
        <button
          @click="openAddModal"
          class="px-4 py-2 bg-primary text-white font-bold text-xs rounded-xl shadow-sm hover:bg-primary/90 transition-all inline-flex items-center gap-2 cursor-pointer"
        >
          <span class="material-symbols-outlined text-base">add</span>
          <span>{{ t('addNewUser') }}</span>
        </button>
      </div>

      <!-- Desktop Data Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="border-b border-outline-variant bg-surface-container-low/50 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
              <th class="py-3.5 px-5">User</th>
              <th class="py-3.5 px-4">System Role</th>
              <th class="py-3.5 px-4">Contact</th>
              <th class="py-3.5 px-4">Status</th>
              <th class="py-3.5 px-4">Created Date</th>
              <th class="py-3.5 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-outline-variant/60 text-sm font-medium">
            <tr
              v-for="user in processedUsers"
              :key="user.id"
              class="hover:bg-surface-container-low/60 transition-colors group"
            >
              <!-- User Info (Name + Email + Avatar) -->
              <td class="py-3.5 px-5">
                <div class="flex items-center gap-3">
                  <div 
                    class="w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 shadow-3xs"
                    :class="user.role === 'MANAGER' ? 'bg-purple-100 text-purple-700' :
                           user.role === 'CASHIER' ? 'bg-blue-100 text-blue-700' :
                           user.role === 'CHEF' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'"
                  >
                    {{ getInitials(user.name) }}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-bold text-on-surface truncate">{{ user.name }}</span>
                      <span 
                        v-if="isSelf(user)" 
                        class="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary rounded-md shrink-0"
                      >
                        You
                      </span>
                    </div>
                    <span class="text-xs text-on-surface-variant truncate block">{{ user.email }}</span>
                  </div>
                </div>
              </td>

              <!-- System Role Badge -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span 
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border shadow-3xs"
                  :class="getRoleBadgeClass(user.role)"
                >
                  <span class="material-symbols-outlined text-sm">{{ getRoleIcon(user.role) }}</span>
                  <span>{{ getRoleLabel(user.role) }}</span>
                </span>
              </td>

              <!-- Contact / Phone -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <span v-if="user.phone" class="text-xs font-semibold text-on-surface flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-xs text-on-surface-variant">phone</span>
                  <span>{{ user.phone }}</span>
                </span>
                <span v-else class="text-xs text-on-surface-variant italic">
                  {{ currentLang === 'km' ? 'គ្មានលេខទូរស័ព្ទ' : 'No phone' }}
                </span>
              </td>

              <!-- Status Toggle Switch -->
              <td class="py-3.5 px-4 whitespace-nowrap">
                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="handleToggleStatus(user)"
                    :disabled="isSelf(user)"
                    class="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    :class="user.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'"
                    :title="isSelf(user) ? 'Cannot deactivate self' : (user.status === 'ACTIVE' ? 'Click to deactivate' : 'Click to activate')"
                  >
                    <span
                      class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                      :class="user.status === 'ACTIVE' ? 'translate-x-4' : 'translate-x-0'"
                    />
                  </button>
                  <span 
                    class="text-xs font-bold"
                    :class="user.status === 'ACTIVE' ? 'text-emerald-700' : 'text-slate-500'"
                  >
                    {{ user.status === 'ACTIVE' ? t('statusActive') : t('statusInactive') }}
                  </span>
                </div>
              </td>

              <!-- Created Date -->
              <td class="py-3.5 px-4 whitespace-nowrap text-xs text-on-surface-variant">
                {{ formatDate(user.createdAt) }}
              </td>

              <!-- Actions Buttons -->
              <td class="py-3.5 px-5 text-right whitespace-nowrap">
                <div class="flex items-center justify-end gap-1">
                  <!-- Reset Password Action -->
                  <button
                    @click="openResetModal(user)"
                    class="p-1.5 text-on-surface-variant hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                    :title="t('resetUserPassword')"
                  >
                    <span class="material-symbols-outlined text-lg">key</span>
                  </button>

                  <!-- Edit Action -->
                  <button
                    @click="openEditModal(user)"
                    class="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-all cursor-pointer"
                    :title="t('editUser')"
                  >
                    <span class="material-symbols-outlined text-lg">edit</span>
                  </button>

                  <!-- Delete Action -->
                  <button
                    @click="openDeleteModal(user)"
                    :disabled="isSelf(user) || user.id === 1"
                    class="p-1.5 text-on-surface-variant hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    :title="isSelf(user) ? 'Cannot delete self' : t('deleteUser')"
                  >
                    <span class="material-symbols-outlined text-lg">delete</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ADD USER MODAL -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-outline-variant relative overflow-hidden">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <span class="p-2 bg-primary/10 text-primary rounded-xl">
              <span class="material-symbols-outlined text-xl">person_add</span>
            </span>
            <h3 class="text-xl font-bold text-on-surface">{{ t('addNewUser') }}</h3>
          </div>
          <button
            @click="showAddModal = false"
            class="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-all"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Form Error Banner -->
        <div v-if="formError" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <span class="material-symbols-outlined text-base">error</span>
          <span>{{ formError }}</span>
        </div>

        <form @submit.prevent="handleCreateUser" class="space-y-4">
          <!-- Full Name -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('fullName') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.name"
              type="text"
              required
              placeholder="e.g. Chanthou Sok"
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Email Address -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('email') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.email"
              type="email"
              required
              placeholder="e.g. chanthou@example.com"
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Password with Eye Toggle -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('password') }} <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                v-model="userForm.password"
                :type="showFormPassword ? 'text' : 'password'"
                required
                minlength="4"
                placeholder="••••••••"
                class="w-full pl-4 pr-11 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <button
                type="button"
                @click="showFormPassword = !showFormPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span class="material-symbols-outlined text-lg">
                  {{ showFormPassword ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <!-- Phone Number -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('phoneNumber') }}
            </label>
            <input
              v-model="userForm.phone"
              type="tel"
              placeholder="e.g. +855 12 345 678"
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Role Selection -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('roleAccessLevel') }} <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="roleItem in [
                  { key: 'MANAGER', label: t('userRoleManager'), desc: 'Full Dashboard & Settings', icon: 'admin_panel_settings' },
                  { key: 'CASHIER', label: t('userRoleCashier'), desc: 'Cashier Console & Billing', icon: 'point_of_sale' },
                  { key: 'CHEF', label: t('userRoleChef'), desc: 'Kitchen Ticket Screen', icon: 'restaurant' },
                  { key: 'CUSTOMER', label: t('userRoleCustomer'), desc: 'Table Digital Menu', icon: 'person' }
                ]"
                :key="roleItem.key"
                type="button"
                @click="userForm.role = roleItem.key as UserRole"
                class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2"
                :class="userForm.role === roleItem.key 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'"
              >
                <span class="material-symbols-outlined text-lg text-primary mt-0.5">{{ roleItem.icon }}</span>
                <div>
                  <p class="text-xs font-bold text-on-surface">{{ roleItem.label }}</p>
                  <p class="text-[10px] text-on-surface-variant">{{ roleItem.desc }}</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Status Toggle -->
          <div class="flex items-center justify-between pt-2">
            <div>
              <span class="text-xs font-bold text-on-surface block">Account Active Status</span>
              <span class="text-[11px] text-on-surface-variant">Active accounts can immediately sign in.</span>
            </div>
            <button
              type="button"
              @click="userForm.status = userForm.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="userForm.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="userForm.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Dialog Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
            <button
              type="button"
              @click="showAddModal = false"
              class="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-all cursor-pointer"
            >
              {{ t('cancelBtn') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span v-if="isSubmitting" class="material-symbols-outlined animate-spin text-base">progress_activity</span>
              <span>{{ isSubmitting ? t('creatingUser') : t('createUserBtn') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- EDIT USER MODAL -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-white rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border border-outline-variant relative overflow-hidden">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <span class="p-2 bg-primary/10 text-primary rounded-xl">
              <span class="material-symbols-outlined text-xl">edit</span>
            </span>
            <h3 class="text-xl font-bold text-on-surface">{{ t('editUser') }}</h3>
          </div>
          <button
            @click="showEditModal = false"
            class="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-all"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <!-- Form Error Banner -->
        <div v-if="formError" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <span class="material-symbols-outlined text-base">error</span>
          <span>{{ formError }}</span>
        </div>

        <form @submit.prevent="handleUpdateUser" class="space-y-4">
          <!-- Full Name -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('fullName') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.name"
              type="text"
              required
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Email Address -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('email') }} <span class="text-red-500">*</span>
            </label>
            <input
              v-model="userForm.email"
              type="email"
              required
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Optional New Password -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('newPasswordOptional') }}
            </label>
            <div class="relative">
              <input
                v-model="userForm.password"
                :type="showFormPassword ? 'text' : 'password'"
                minlength="4"
                placeholder="••••••••"
                class="w-full pl-4 pr-11 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <button
                type="button"
                @click="showFormPassword = !showFormPassword"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span class="material-symbols-outlined text-lg">
                  {{ showFormPassword ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <!-- Phone Number -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('phoneNumber') }}
            </label>
            <input
              v-model="userForm.phone"
              type="tel"
              placeholder="e.g. +855 12 345 678"
              class="w-full px-4 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
            />
          </div>

          <!-- Role Selection -->
          <div>
            <label class="block text-xs font-bold text-on-surface mb-1.5">
              {{ t('roleAccessLevel') }} <span class="text-red-500">*</span>
            </label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="roleItem in [
                  { key: 'MANAGER', label: t('userRoleManager'), desc: 'Full Dashboard & Settings', icon: 'admin_panel_settings' },
                  { key: 'CASHIER', label: t('userRoleCashier'), desc: 'Cashier Console & Billing', icon: 'point_of_sale' },
                  { key: 'CHEF', label: t('userRoleChef'), desc: 'Kitchen Ticket Screen', icon: 'restaurant' },
                  { key: 'CUSTOMER', label: t('userRoleCustomer'), desc: 'Table Digital Menu', icon: 'person' }
                ]"
                :key="roleItem.key"
                type="button"
                @click="userForm.role = roleItem.key as UserRole"
                class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-2"
                :class="userForm.role === roleItem.key 
                  ? 'border-primary bg-primary/5 ring-1 ring-primary' 
                  : 'border-outline-variant bg-surface-container-low hover:bg-surface-container'"
              >
                <span class="material-symbols-outlined text-lg text-primary mt-0.5">{{ roleItem.icon }}</span>
                <div>
                  <p class="text-xs font-bold text-on-surface">{{ roleItem.label }}</p>
                  <p class="text-[10px] text-on-surface-variant">{{ roleItem.desc }}</p>
                </div>
              </button>
            </div>
          </div>

          <!-- Status Toggle -->
          <div class="flex items-center justify-between pt-2">
            <div>
              <span class="text-xs font-bold text-on-surface block">Account Active Status</span>
              <span class="text-[11px] text-on-surface-variant">Active accounts can sign in and work.</span>
            </div>
            <button
              type="button"
              @click="userForm.status = userForm.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
              :class="userForm.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-slate-300'"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                :class="userForm.status === 'ACTIVE' ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Dialog Actions -->
          <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
            <button
              type="button"
              @click="showEditModal = false"
              class="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-all cursor-pointer"
            >
              {{ t('cancelBtn') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-bold text-xs rounded-xl shadow-md shadow-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span v-if="isSubmitting" class="material-symbols-outlined animate-spin text-base">progress_activity</span>
              <span>{{ isSubmitting ? t('updatingUser') : t('saveUserBtn') }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- RESET PASSWORD MODAL -->
    <div
      v-if="showResetModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-outline-variant relative overflow-hidden">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-3">
            <span class="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <span class="material-symbols-outlined text-xl">key</span>
            </span>
            <div>
              <h3 class="text-lg font-bold text-on-surface">{{ t('resetUserPassword') }}</h3>
              <p class="text-xs text-on-surface-variant">{{ resetPasswordForm.name }} ({{ resetPasswordForm.email }})</p>
            </div>
          </div>
          <button
            @click="showResetModal = false"
            class="text-on-surface-variant hover:text-on-surface p-1.5 rounded-lg hover:bg-surface-container transition-all"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div v-if="formError" class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2">
          <span class="material-symbols-outlined text-base">error</span>
          <span>{{ formError }}</span>
        </div>

        <form @submit.prevent="handleResetPassword" class="space-y-4">
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-xs font-bold text-on-surface">
                New Temporary Password <span class="text-red-500">*</span>
              </label>
              <button
                type="button"
                @click="generateRandomPassword"
                class="text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span class="material-symbols-outlined text-sm">casino</span>
                <span>Auto-Generate</span>
              </button>
            </div>

            <div class="relative">
              <input
                v-model="resetPasswordForm.newPassword"
                :type="showResetPasswordToggle ? 'text' : 'password'"
                required
                minlength="4"
                placeholder="Enter new password"
                class="w-full pl-4 pr-11 py-2.5 bg-surface-container rounded-xl text-sm font-medium border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary outline-none transition-all"
              />
              <button
                type="button"
                @click="showResetPasswordToggle = !showResetPasswordToggle"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant hover:text-on-surface rounded-lg"
              >
                <span class="material-symbols-outlined text-lg">
                  {{ showResetPasswordToggle ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant">
            <button
              type="button"
              @click="showResetModal = false"
              class="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-all cursor-pointer"
            >
              {{ t('cancelBtn') }}
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span v-if="isSubmitting" class="material-symbols-outlined animate-spin text-base">progress_activity</span>
              <span>{{ isSubmitting ? 'Updating...' : 'Confirm Reset' }}</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- DELETE USER CONFIRMATION MODAL -->
    <div
      v-if="showDeleteModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-white rounded-3xl max-w-md w-full p-6 md:p-8 shadow-2xl border border-outline-variant relative overflow-hidden">
        <div class="flex items-center gap-3 mb-4 text-red-600">
          <span class="p-2.5 bg-red-50 rounded-2xl flex items-center justify-center">
            <span class="material-symbols-outlined text-2xl">warning</span>
          </span>
          <h3 class="text-xl font-bold text-on-surface">{{ t('confirmDeleteTitle') }}</h3>
        </div>

        <p class="text-sm text-on-surface-variant mb-4 leading-relaxed">
          {{ t('confirmDeleteMsg') }}
        </p>

        <div v-if="userToDelete" class="p-3 bg-surface-container rounded-xl mb-6 flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs">
            {{ getInitials(userToDelete.name) }}
          </div>
          <div>
            <p class="font-bold text-xs text-on-surface">{{ userToDelete.name }}</p>
            <p class="text-[11px] text-on-surface-variant">{{ userToDelete.email }} • {{ getRoleLabel(userToDelete.role) }}</p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            @click="showDeleteModal = false"
            class="px-4 py-2.5 text-xs font-bold text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-xl transition-all cursor-pointer"
          >
            {{ t('cancelBtn') }}
          </button>
          <button
            type="button"
            @click="handleDeleteUser"
            :disabled="isSubmitting"
            class="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span v-if="isSubmitting" class="material-symbols-outlined animate-spin text-base">progress_activity</span>
            <span>{{ isSubmitting ? 'Deleting...' : t('deleteActionBtn') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Floating Toast Notifications -->
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 text-xs font-bold animate-slide-up pointer-events-auto"
        :class="toast.type === 'success' ? 'bg-emerald-800 text-white border-emerald-700' :
               toast.type === 'error' ? 'bg-rose-800 text-white border-rose-700' : 'bg-slate-800 text-white border-slate-700'"
      >
        <span class="material-symbols-outlined text-base">
          {{ toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info' }}
        </span>
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.animate-fade-in {
  animation: fadeIn 0.15s ease-out forwards;
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-slide-up {
  animation: slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
