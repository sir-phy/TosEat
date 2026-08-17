<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed } from 'vue'
import { t, currentLang, setLang } from '../i18n'
import { logout } from '../services/auth'

const route = useRoute()
const router = useRouter()

const sidebarLinks = computed(() => [
  { name: t('dashboard'), icon: 'grid_view', path: '/dashboard' },
  { name: t('analytics'), icon: 'analytics', path: '/analytics' },
  { name: t('userManagement'), icon: 'manage_accounts', path: '/users' },
  { name: t('settings'), icon: 'settings', path: '#' }
])

const handleLogout = async () => {
  await logout()
  router.push('/')
}
</script>

<template>
  <div class="flex bg-surface min-h-screen">
    <!-- Sidebar (Persistent) -->
    <aside class="w-64 fixed left-0 top-0 h-full hidden lg:flex flex-col bg-white border-r border-surface-variant p-6 gap-8 z-50">
      <div class="px-2">
        <h1 class="text-3xl font-black text-on-surface">TosEat.</h1>
        <p class="text-xs font-bold text-on-surface-variant mt-1 uppercase tracking-widest italic">{{ t('ownerPortal') }}</p>
      </div>

      <nav class="flex flex-col gap-2">
        <router-link 
          v-for="link in sidebarLinks" 
          :key="link.name"
          :to="link.path"
          class="flex items-center gap-3 p-3 rounded-xl transition-all font-bold text-sm"
          :class="route.path === link.path ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-on-surface-variant hover:bg-surface-container'"
        >
          <span class="material-symbols-outlined" :style="route.path === link.path ? 'font-variation-settings: \'FILL\' 1' : ''">{{ link.icon }}</span>
          {{ link.name }}
        </router-link>
      </nav>

      <div class="mt-auto flex flex-col gap-4">
        <!-- Language Switcher inside Sidebar -->
        <div class="px-2 py-4 border-t border-surface-variant/40">
          <label class="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-2">{{ currentLang === 'km' ? 'ភាសា / Language' : 'Language / ភាសា' }}</label>
          <div class="flex items-center gap-1 bg-surface-container-low border border-surface-variant rounded-xl p-1 shadow-3xs">
            <button 
              @click="setLang('en')" 
              class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="currentLang === 'en' ? 'bg-primary text-white shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'"
            >
              EN
            </button>
            <button 
              @click="setLang('km')" 
              class="flex-1 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="currentLang === 'km' ? 'bg-primary text-white shadow-sm font-black' : 'text-on-surface-variant hover:text-on-surface'"
            >
              ខ្មែរ
            </button>
          </div>
        </div>

        <button 
          @click="handleLogout" 
          class="flex items-center gap-3 p-3 rounded-xl text-secondary hover:text-error hover:bg-rose-50/50 transition-colors font-bold text-sm text-left w-full cursor-pointer"
        >
          <span class="material-symbols-outlined">logout</span>
          {{ t('logout') }}
        </button>
      </div>
    </aside>

    <!-- Content Area (Transitions here) -->
    <div class="flex-1 lg:pl-64 min-w-0 pb-20 lg:pb-0">
      <router-view v-slot="{ Component }">
        <transition 
          name="page-fade" 
          mode="out-in"
          appear
        >
          <component :is="Component" :key="route.path" />
        </transition>
      </router-view>
    </div>

    <!-- Mobile Bottom Navigation Bar (Visible only on screens below lg) -->
    <nav class="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 px-4 py-2.5 flex justify-around items-center shadow-lg">
      <router-link 
        v-for="link in sidebarLinks" 
        :key="link.name"
        :to="link.path"
        class="flex flex-col items-center gap-1 p-1.5 transition-all font-bold text-[10px]"
        :class="route.path === link.path ? 'text-primary' : 'text-slate-500 hover:text-slate-800'"
      >
        <span class="material-symbols-outlined text-lg leading-none" :style="route.path === link.path ? 'font-variation-settings: \'FILL\' 1' : ''">{{ link.icon }}</span>
        <span>{{ link.name }}</span>
      </router-link>
      <button 
        @click="handleLogout" 
        class="flex flex-col items-center gap-1 p-1.5 text-rose-600 transition-colors font-bold text-[10px] cursor-pointer"
      >
        <span class="material-symbols-outlined text-lg leading-none">logout</span>
        <span>{{ t('logout') }}</span>
      </button>
    </nav>
  </div>
</template>

<style scoped>
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
