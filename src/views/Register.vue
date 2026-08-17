<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { t, currentLang, setLang } from '../i18n'
import { register } from '../services/auth'

const router = useRouter()
const route = useRoute()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const agreeTerms = ref(false)
const isLoading = ref(false)
const errorMessage = ref('')
const accessDeniedNotice = ref('')

onMounted(() => {
  if (route.query.denied === 'unauthenticated') {
    accessDeniedNotice.value = currentLang.value === 'km' 
      ? 'សូមចូលគណនីជាមុនសិនដើម្បីប្រើប្រាស់ផ្ទាំងការងារនេះ!' 
      : 'Authentication required. Please sign in with appropriate credentials to access that workspace.'
  } else if (route.query.denied === 'insufficient_role') {
    accessDeniedNotice.value = currentLang.value === 'km' 
      ? 'ការចូលត្រូវបានបដិសេធ៖ តួនាទីរបស់អ្នកមិនមានសិទ្ធិចូលទំព័រនេះទេ!' 
      : 'Access Denied: Your current role does not have permission for that area.'
  }
})

const setDemoCredentials = (roleType: 'manager' | 'cashier' | 'chef') => {
  errorMessage.value = ''
  accessDeniedNotice.value = ''
  agreeTerms.value = true
  if (roleType === 'manager') {
    email.value = 'manager@example.com'
    password.value = 'password'
  } else if (roleType === 'cashier') {
    email.value = 'cashier@example.com'
    password.value = 'password'
  } else if (roleType === 'chef') {
    email.value = 'chef@example.com'
    password.value = 'password'
  }
}

const handleRegister = async () => {
  errorMessage.value = ''
  accessDeniedNotice.value = ''

  // Validate email credential
  const cleanEmail = email.value.trim()
  if (!cleanEmail) {
    errorMessage.value = currentLang.value === 'km' 
      ? 'សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក!' 
      : 'Please enter your email address.'
    return
  }

  // Simple email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cleanEmail)) {
    errorMessage.value = currentLang.value === 'km' 
      ? 'សូមបញ្ចូលទម្រង់អ៊ីមែលឱ្យបានត្រឹមត្រូវ!' 
      : 'Please enter a valid email address.'
    return
  }

  // Validate password credential
  if (!password.value || password.value.trim().length === 0) {
    errorMessage.value = currentLang.value === 'km' 
      ? 'សូមបញ្ចូលពាក្យសម្ងាត់របស់អ្នក!' 
      : 'Please enter your password.'
    return
  }

  if (password.value.length < 4) {
    errorMessage.value = currentLang.value === 'km' 
      ? 'សូមបញ្ចូលពាក្យសម្ងាត់យ៉ាងតិច ៤ តួអក្សរ!' 
      : 'Password must be at least 4 characters.'
    return
  }

  if (!agreeTerms.value) {
    errorMessage.value = currentLang.value === 'km' 
      ? 'សូមយល់ព្រមលើលក្ខខណ្ឌ និងសេចក្តីកំណត់ជាមុនសិន!' 
      : 'Please agree to the Terms and Conditions before proceeding.'
    return
  }

  isLoading.value = true
  try {
    const result = await register({
      email: cleanEmail,
      password: password.value,
      role: 'customer'
    })

    // Role-Based routing based on authenticated identity
    const userRole = result.user.role
    if (userRole === 'MANAGER') {
      router.push('/dashboard')
    } else if (userRole === 'CHEF') {
      router.push('/chef')
    } else if (userRole === 'CASHIER') {
      router.push('/cashier')
    } else {
      const savedTable = localStorage.getItem('gomeal_selected_table') || '01'
      router.push(`/menu/${savedTable}`)
    }
  } catch (err: any) {
    // WRONG CREDENTIALS: Stays on page and only shows message
    errorMessage.value = err.message || (
      currentLang.value === 'km' 
        ? 'ព័ត៌មានសម្ងាត់មិនត្រឹមត្រូវ! សូមពិនិត្យអ៊ីមែល និងពាក្យសម្ងាត់របស់អ្នកឡើងវិញ។' 
        : 'Invalid credentials. Please check your email and password.'
    )
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="min-h-screen flex flex-col md:flex-row relative">
    <!-- Language Toggle at Top-right -->
    <div class="absolute top-6 right-6 z-50 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-full p-1 transition-all md:bg-white/80 md:backdrop-blur-sm">
      <button 
        type="button"
        @click="setLang('en')" 
        class="px-3 py-1.5 text-xs font-black rounded-lg transition-all"
        :class="currentLang === 'en' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
      >
        EN
      </button>
      <button 
        type="button"
        @click="setLang('km')" 
        class="px-3 py-1.5 text-xs font-black rounded-lg transition-all"
        :class="currentLang === 'km' ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:text-on-surface'"
      >
        ខ្មែរ
      </button>
    </div>

    <!-- Brand/Marketing Section -->
    <section class="hidden md:flex md:w-1/2 lg:w-3/5 bg-primary relative items-center justify-center p-8 overflow-hidden">
      <div class="absolute inset-0 z-0">
        <img 
          class="w-full h-full object-cover mix-blend-multiply opacity-40" 
          src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=2070" 
          alt="Kitchen"
        />
      </div>
      <div class="relative z-10 text-center max-w-xl">
        <h1 class="text-6xl font-black text-white mb-4">TosEat.</h1>
        <p class="text-2xl font-bold text-primary-fixed mb-12">
          {{ currentLang === 'km' ? 'ជួយសម្រួលដល់ដំណើរការគ្រប់គ្រង និងកុម្ម៉ង់មុខម្ហូបក្នុងភោជនីយដ្ឋានរបស់អ្នកឱ្យកាន់តែលឿនរហ័ស!' : 'Empowering culinary teams with the ultimate restaurant management ecosystem.' }}
        </p>
        
        <div class="grid grid-cols-2 gap-4 text-left">
          <div class="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20">
            <span class="material-symbols-outlined text-primary-container mb-2">speed</span>
            <h3 class="text-white font-bold mb-1">
              {{ currentLang === 'km' ? 'ប្រតិបត្តិការប្រកបដោយប្រសិទ្ធភាព' : 'Efficient Operations' }}
            </h3>
            <p class="text-white/80 text-xs">
              {{ currentLang === 'km' ? 'គ្រប់គ្រងការកុម្ម៉ង់អាហារ និងដំណើរការការងារក្នុងផ្ទះបាយដោយមិនបាច់ខំប្រឹង។' : 'Streamline your orders and kitchen workflows effortlessly.' }}
            </p>
          </div>
          <div class="bg-white/10 backdrop-blur-md p-6 rounded-xl border border-white/20">
            <span class="material-symbols-outlined text-primary-container mb-2">analytics</span>
            <h3 class="text-white font-bold mb-1">
              {{ currentLang === 'km' ? 'ទិន្នន័យផ្ទាល់ភ្លាមៗ' : 'Real-time Data' }}
            </h3>
            <p class="text-white/80 text-xs">
              {{ currentLang === 'km' ? 'ពិនិត្យមើលរបាយការណ៍ និងការវិភាគអាជីវកម្មគ្រប់ពេលវេលា គ្រប់ទីកន្លែង។' : 'Access critical business insights anytime, anywhere.' }}
            </p>
          </div>
        </div>
      </div>
      
      <!-- Floating Decorative Elements -->
      <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-primary-container/30 rounded-full blur-3xl"></div>
      <div class="absolute -top-20 -right-20 w-80 h-80 bg-secondary/20 rounded-full blur-3xl"></div>
    </section>

    <!-- Authentication Form Section -->
    <section class="flex-1 flex flex-col items-center justify-center p-6 md:p-12 bg-surface">
      <div class="w-full max-w-md">
        <div class="mb-6">
          <h2 class="text-3xl md:text-4xl font-bold text-on-surface mb-2">{{ t('registerTitle') }}</h2>
          <p class="text-on-surface-variant text-sm">{{ t('registerSubtitle') }}</p>
        </div>

        <!-- Access Denied Guard Alert -->
        <div 
          v-if="accessDeniedNotice" 
          class="mb-5 p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold rounded-xl flex items-center gap-2.5 shadow-sm"
        >
          <span class="material-symbols-outlined text-lg shrink-0 text-amber-600">shield_lock</span>
          <span>{{ accessDeniedNotice }}</span>
        </div>

        <!-- Wrong Credential / Error Alert Banner -->
        <div 
          v-if="errorMessage" 
          class="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs font-bold rounded-xl flex items-center gap-2.5 shadow-sm animate-shake"
        >
          <span class="material-symbols-outlined text-lg shrink-0">error</span>
          <span>{{ errorMessage }}</span>
        </div>

        <!-- Staff Demo Role Presets for Quick Testing -->
        <div class="mb-5 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <p class="text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">
            {{ currentLang === 'km' ? 'គណនីសាកល្បង / Demo Staff Presets' : 'Quick Staff Credentials (RBAC)' }}
          </p>
          <div class="flex items-center gap-2">
            <button 
              type="button" 
              @click="setDemoCredentials('manager')"
              class="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-primary/10 hover:text-primary border border-slate-200 rounded-lg transition-all shadow-xs"
            >
              Manager
            </button>
            <button 
              type="button" 
              @click="setDemoCredentials('cashier')"
              class="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-primary/10 hover:text-primary border border-slate-200 rounded-lg transition-all shadow-xs"
            >
              Cashier
            </button>
            <button 
              type="button" 
              @click="setDemoCredentials('chef')"
              class="px-2.5 py-1.5 text-xs font-bold bg-white hover:bg-primary/10 hover:text-primary border border-slate-200 rounded-lg transition-all shadow-xs"
            >
              Chef
            </button>
          </div>
        </div>

        <form @submit.prevent="handleRegister" class="space-y-5">
          <!-- Credentials Info -->
          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider" for="reg-email">
                {{ t('email') }} <span class="text-red-500">*</span>
              </label>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">mail</span>
                <input 
                  id="reg-email"
                  v-model="email"
                  type="email" 
                  required
                  placeholder="name@example.com"
                  class="w-full pl-12 pr-4 py-3 bg-surface-container rounded-xl border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary-container transition-all outline-none text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider" for="reg-password">
                {{ t('password') }} <span class="text-red-500">*</span>
              </label>
              <div class="relative group">
                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors pointer-events-none select-none">lock</span>
                <input 
                  id="reg-password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'" 
                  required
                  minlength="4"
                  placeholder="••••••••"
                  class="w-full pl-12 pr-12 py-3 bg-surface-container rounded-xl border-none ring-1 ring-outline-variant focus:ring-2 focus:ring-primary-container transition-all outline-none text-sm font-medium"
                />
                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-outline hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all flex items-center justify-center cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary-container"
                  :title="showPassword ? (currentLang === 'km' ? 'លាក់ពាក្យសម្ងាត់' : 'Hide password') : (currentLang === 'km' ? 'បង្ហាញពាក្យសម្ងាត់' : 'Show password')"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <span class="material-symbols-outlined text-xl select-none">
                    {{ showPassword ? 'visibility_off' : 'visibility' }}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- Terms & Conditions Requirement -->
          <div class="flex items-center gap-3">
            <input 
              type="checkbox" 
              id="terms" 
              v-model="agreeTerms"
              required
              class="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary-container cursor-pointer"
            />
            <label for="terms" class="text-sm text-on-surface-variant select-none cursor-pointer">
              {{ currentLang === 'km' ? 'ខ្ញុំយល់ព្រមតាម' : 'I agree to the' }} <span class="text-primary font-bold">{{ currentLang === 'km' ? 'លក្ខខណ្ឌ និងសេចក្តីកំណត់' : 'Terms and Conditions' }}</span> <span class="text-red-500">*</span>
            </label>
          </div>

          <!-- Submit Button -->
          <button 
            type="submit"
            :disabled="isLoading"
            class="w-full py-4 bg-primary text-white font-bold rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:bg-primary/90 active:scale-95 transition-all duration-150 mt-4 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <span v-if="isLoading" class="material-symbols-outlined animate-spin text-xl">progress_activity</span>
            <span>{{ isLoading ? (currentLang === 'km' ? 'កំពុងផ្ទៀងផ្ទាត់...' : 'Verifying & Continuing...') : t('regBtn') }}</span>
          </button>

          <!-- Direct Guest Access to Menu (Accessible to ALL users) -->
          <div class="pt-3 text-center border-t border-surface-variant/40">
            <p class="text-xs text-on-surface-variant mb-2">
              {{ currentLang === 'km' ? 'ឬចូលមើលបញ្ជីមុខម្ហូបជាភ្ញៀវផ្ទាល់៖' : 'Or dine directly without signing in:' }}
            </p>
            <router-link 
              to="/menu/01" 
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-container-high hover:bg-primary/10 text-on-surface hover:text-primary text-xs font-bold rounded-xl transition-all border border-outline-variant/50"
            >
              <span class="material-symbols-outlined text-base">restaurant_menu</span>
              <span>{{ currentLang === 'km' ? 'បើកមើលបញ្ជីមុខម្ហូបតុ ០១ (ទាំងអស់គ្នា)' : 'Open Table 01 Menu (Open to All)' }}</span>
            </router-link>
          </div>
        </form>

        <!-- Mobile Brand -->
        <div class="mt-10 md:hidden text-center">
          <span class="text-3xl font-black text-primary">TosEat.</span>
        </div>
      </div>
    </section>
  </main>
</template>

