<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { t, currentLang, setLang, translateDishName, translateIngredient } from '../i18n'
import { kitchenService, KitchenQueueItem } from '../services/kitchen.js'
import { getSocket } from '../services/socket.js'
import { getAccessToken, setAccessToken } from '../services/api.js'
import { login, logout } from '../services/auth.js'

const router = useRouter()

const handleLogout = async () => {
  await logout()
  router.push('/')
}

interface CustomizedDetail {
  name: string
  originalAmount: number
  amount: number
  unit: string
  diff: number
  isIncrease: boolean
}

interface OrderItem {
  id: number
  orderId?: number
  name: string
  price: number
  quantity: number
  image?: string
  status: 'Preparing' | 'Sent to Kitchen' | 'Served'
  customizations?: string
  customizedDetails?: CustomizedDetail[]
  timePlaced?: string
  tableNo?: string
  servedAt?: number
}

// Active orders list synced with Backend and Customer view
const orders = ref<OrderItem[]>([])
const selectedFilter = ref<string>('All')
const searchQuery = ref<string>('')
const alertToastMessage = ref<string>('')
const isToastVisible = ref<boolean>(false)
const currentTime = ref<number>(Date.now())

const showToast = (message: string) => {
  alertToastMessage.value = message
  isToastVisible.value = true
  setTimeout(() => {
    isToastVisible.value = false
  }, 4000)
}

const loadOrders = async () => {
  try {
    // Ensure auth token exists for chef
    if (!getAccessToken()) {
      await login({ email: 'chef@example.com', password: 'password' })
    }

    const res = await kitchenService.getQueue()
    if (res.data && Array.isArray(res.data) && res.data.length > 0) {
      const mapped: OrderItem[] = []
      res.data.forEach((qItem: KitchenQueueItem) => {
        const orderTable = qItem.table?.tableNumber || String(qItem.tableId) || '12B'
        const orderStatus: 'Preparing' | 'Sent to Kitchen' | 'Served' = 
          qItem.status === 'PREPARING' ? 'Sent to Kitchen' :
          qItem.status === 'READY' || qItem.status === 'SERVED' ? 'Served' : 'Preparing'

        qItem.items.forEach((dish, idx) => {
          mapped.push({
            id: qItem.id * 100 + idx,
            orderId: qItem.id,
            name: dish.name,
            price: 12.50,
            quantity: dish.quantity,
            image: dish.image,
            status: orderStatus,
            customizations: dish.customizationNote || 'Standard Portions',
            customizedDetails: (dish.customizations || []).map((c: any) => ({
              name: c.name || `Ingredient #${c.ingredientId}`,
              originalAmount: c.originalAmount || 1,
              amount: c.amount || 1,
              unit: c.unit || 'pcs',
              diff: c.difference || 0,
              isIncrease: !!c.isIncrease
            })),
            timePlaced: new Date(qItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            tableNo: orderTable,
            servedAt: qItem.status === 'SERVED' ? Date.now() : undefined
          })
        })
      })
      orders.value = mapped
      localStorage.setItem('gomeal_customer_orders', JSON.stringify(mapped))
      return
    }
  } catch (err) {
    // Fallback to local storage if offline or server booting
  }

  const stored = localStorage.getItem('gomeal_customer_orders')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      let changed = false
      const mapped = parsed.map((item: any) => {
        let servedAt = item.servedAt
        if (item.status === 'Served' && !servedAt) {
          servedAt = Date.now()
          changed = true
        }
        return {
          ...item,
          tableNo: item.tableNo || '12B',
          timePlaced: item.timePlaced || 'Just now',
          servedAt
        }
      })
      orders.value = mapped
      if (changed) {
        localStorage.setItem('gomeal_customer_orders', JSON.stringify(mapped))
      }
    } catch (e) {
      console.error('Error loading orders:', e)
    }
  }
}

const saveOrders = () => {
  localStorage.setItem('gomeal_customer_orders', JSON.stringify(orders.value))
}

// History Storage state
const ticketHistory = ref<any[]>([])

const loadHistory = () => {
  const stored = localStorage.getItem('gomeal_ticket_history')
  if (stored) {
    try {
      ticketHistory.value = JSON.parse(stored)
    } catch (e) {
      console.error('Error loading history:', e)
    }
  } else {
    // Seed some realistic historical orders from the past few days!
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    const tempHistory = [
      {
        id: 1001,
        name: 'Pepperoni Pizza',
        price: 18.99,
        quantity: 1,
        tableNo: '02',
        customizations: 'Standard Portions',
        servedAt: today.getTime() - 3600000, // 1 hour ago
        status: 'Served'
      },
      {
        id: 1002,
        name: 'Fried Rice',
        price: 10.45,
        quantity: 2,
        tableNo: '05',
        customizations: 'Standard Portions',
        servedAt: yesterday.getTime() - 7200000, 
        status: 'Served'
      },
      {
        id: 1003,
        name: 'Vegan Salad',
        price: 13.20,
        quantity: 3,
        tableNo: '12B',
        customizations: 'Citrus Dressing: 2 -> 3 portions',
        customizedDetails: [
          { name: 'Citrus Dressing', originalAmount: 2, amount: 3, unit: 'portions', diff: 1, isIncrease: true }
        ],
        servedAt: yesterday.getTime() - 14400005,
        status: 'Served'
      },
      {
        id: 1004,
        name: 'Cheese Burger',
        price: 12.50,
        quantity: 1,
        tableNo: '01',
        customizations: 'Double Cheddar: 2 -> 4 pcs',
        customizedDetails: [
          { name: 'Double Cheddar', originalAmount: 2, amount: 4, unit: 'pcs', diff: 2, isIncrease: true }
        ],
        servedAt: twoDaysAgo.getTime() - 10000000,
        status: 'Served'
      }
    ]
    localStorage.setItem('gomeal_ticket_history', JSON.stringify(tempHistory))
    ticketHistory.value = tempHistory
  }
}

const saveHistory = () => {
  localStorage.setItem('gomeal_ticket_history', JSON.stringify(ticketHistory.value))
}

const updateStatus = async (id: number, status: 'Preparing' | 'Sent to Kitchen' | 'Served') => {
  const item = orders.value.find(o => o.id === id)
  if (item) {
    item.status = status
    if (status === 'Served') {
      item.servedAt = Date.now()
    } else {
      delete item.servedAt
    }
    saveOrders()

    // Call backend API endpoint if orderId exists
    const backendOrderId = item.orderId || (item.id > 1000 ? Math.floor(item.id / 100) : item.id)
    try {
      if (status === 'Sent to Kitchen') {
        await kitchenService.startCooking(backendOrderId)
      } else if (status === 'Served') {
        await kitchenService.markReady(backendOrderId).catch(() => {})
        await kitchenService.markServed(backendOrderId).catch(() => {})
      }
    } catch (apiErr) {
      console.log('Backend sync notice (proceeding):', apiErr)
    }

    // Dispatch messages to customer's table based on chefs status updates
    const tbl = item.tableNo || '12B'
    if (status === 'Sent to Kitchen') {
      const storedNotices = localStorage.getItem('gomeal_delay_messages') || '{}'
      try {
        const notices = JSON.parse(storedNotices)
        notices[tbl] = currentLang.value === 'km'
          ? "យើងចាប់ផ្តើមចម្អិនអាហារឥឡូវនេះ សូមរង់ចាំមួយភ្លែត☺️"
          : "We start cooking now, Please wait a moment☺️."
        localStorage.setItem('gomeal_delay_messages', JSON.stringify(notices))
      } catch (e) {
        console.error(e)
      }
    } else if (status === 'Served') {
      const storedNotices = localStorage.getItem('gomeal_delay_messages') || '{}'
      try {
        const notices = JSON.parse(storedNotices)
        notices[tbl] = currentLang.value === 'km'
          ? "អាហារត្រូវបានចម្អិនរួចរាល់ហើយ 😋"
          : "The food is already done 😋"
        localStorage.setItem('gomeal_delay_messages', JSON.stringify(notices))
      } catch (e) {
        console.error(e)
      }
    }

    const msg = currentLang.value === 'km' 
      ? `ស្ថានភាពកុម្ម៉ង់លេខ #${id % 10000} ត្រូវបានធ្វើបច្ចុប្បន្នភាពទៅជា: ${status === 'Preparing' ? 'កំពុងរៀបចំ' : status === 'Sent to Kitchen' ? 'កំពុងចម្អិន' : 'បានបម្រើ'}`
      : `Order #${id % 10000} status updated to ${status}!`
    showToast(msg)
    window.dispatchEvent(new Event('storage'))
  }
}

const voidOrder = (id: number) => {
  orders.value = orders.value.filter(o => o.id !== id)
  saveOrders()
  const msg = currentLang.value === 'km' ? `ការកុម្ម៉ង់លេខ #${id % 10000} ត្រូវបានបោះបង់ចោល។` : `Order #${id % 10000} has been voided/bumped.`
  showToast(msg)
  window.dispatchEvent(new Event('storage'))
}

const notifyDelay = (tableNo?: string, orderId?: number) => {
  const tbl = tableNo || '12B'
  const storedNotices = localStorage.getItem('gomeal_delay_messages') || '{}'
  try {
    const notices = JSON.parse(storedNotices)
    notices[tbl] = currentLang.value === 'km' ? "អាហារកំពុងចម្អិនយឺតបន្តិច សូមមេត្តារង់ចាំមួយភ្លែត។" : "The food is a bit late, please wait a moment."
    localStorage.setItem('gomeal_delay_messages', JSON.stringify(notices))
  } catch (e) {
    console.error(e)
  }
  const msg = currentLang.value === 'km' ? `តុលេខ ${tbl} ត្រូវបានជូនដំណឹង៖ អាហារយឺតយ៉ាវ!` : `Table ${tbl} notified: Food is a bit late!`
  showToast(msg)
  window.dispatchEvent(new Event('storage'))
}

// Archive/remove individual action
const archiveOrder = (id: number) => {
  const orderIndex = orders.value.findIndex(o => o.id === id)
  if (orderIndex > -1) {
    const order = orders.value[orderIndex]
    
    // Add to history
    const existsInHist = ticketHistory.value.some((h: any) => h.id === order.id)
    if (!existsInHist) {
      ticketHistory.value.unshift({
        id: order.id,
        name: order.name,
        price: order.price,
        quantity: order.quantity,
        tableNo: order.tableNo || '12B',
        customizations: order.customizations || 'Standard Portions',
        customizedDetails: order.customizedDetails || [],
        servedAt: order.servedAt || Date.now(),
        status: 'Served'
      })
      saveHistory()
    }
    
    // Remove from active orders list
    orders.value.splice(orderIndex, 1)
    saveOrders()
    const msg = currentLang.value === 'km' ? `សំបុត្រកម្ម៉ង់លេខ #ORD-${order.id % 10000} ត្រូវបានបញ្ជូនទៅក្នុងឯកសាររួចរាល់។` : `Ticket #ORD-${order.id % 10000} has been archived.`
    showToast(msg)
    window.dispatchEvent(new Event('storage'))
  }
}

const clearHistory = () => {
  const promptMsg = currentLang.value === 'km' 
    ? 'តើអ្នកប្រាកដជាចង់លុបប្រវត្តិកិច្ចការកុម្ម៉ង់ទាំងអស់មែនទេ? វាមិនអាចសង្គ្រោះវិញបានឡើយ។' 
    : 'Are you sure you want to clear all historical log records? This is permanent.'
  if (confirm(promptMsg)) {
    ticketHistory.value = []
    saveHistory()
    const msg = currentLang.value === 'km' ? 'ប្រវត្តិកិច្ចការត្រូវបានលុបទាំងស្រុង។' : 'Historical activity logs cleared.'
    showToast(msg)
  }
}

// Group history by day
const groupedHistory = computed(() => {
  const groups: { [key: string]: any[] } = {}
  
  // Sort descending by completion time (newest first)
  const sorted = [...ticketHistory.value].sort((a, b) => b.servedAt - a.servedAt)
  
  sorted.forEach(item => {
    const date = new Date(item.servedAt)
    const today = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    
    let dateStr = ''
    if (date.toDateString() === today.toDateString()) {
      dateStr = 'Today — ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateStr = 'Yesterday — ' + date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    } else {
      dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })
    }
    
    if (!groups[dateStr]) {
      groups[dateStr] = []
    }
    groups[dateStr].push(item)
  })
  
  return groups
})

// Computed stats
const activeCount = computed(() => orders.value.filter(o => o.status !== 'Served').length)
const preparingCount = computed(() => orders.value.filter(o => o.status === 'Preparing').length)
const readyToServeCount = computed(() => orders.value.filter(o => o.status === 'Sent to Kitchen').length)
const servedCount = computed(() => {
  const activeServed = orders.value.filter(o => o.status === 'Served').length
  const archivedServed = ticketHistory.value.length
  return activeServed + archivedServed
})

const avgPrepTime = computed(() => {
  return 12 // Simulated static helper representing state
})

const filteredOrders = computed(() => {
  let activeOrders = orders.value.filter(o => {
    if (o.status === 'Served' && o.servedAt) {
      return (currentTime.value - o.servedAt) < 60000
    }
    return true
  })

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    activeOrders = activeOrders.filter(o => {
      const nameMatch = translateDishName(o.name).toLowerCase().includes(q) || o.name.toLowerCase().includes(q)
      const tableMatch = o.tableNo?.toLowerCase().includes(q)
      const idMatch = o.id.toString().includes(q)
      return nameMatch || tableMatch || idMatch
    })
  }

  if (selectedFilter.value === 'All') {
    return activeOrders
  }
  if (selectedFilter.value === 'Pending') {
    return activeOrders.filter(o => o.status === 'Preparing')
  }
  if (selectedFilter.value === 'Preparing') {
    return activeOrders.filter(o => o.status === 'Sent to Kitchen')
  }
  if (selectedFilter.value === 'Served') {
    return activeOrders.filter(o => o.status === 'Served')
  }
  if (selectedFilter.value === 'Customized') {
    return activeOrders.filter(o => o.customizedDetails && o.customizedDetails.length > 0)
  }
  return activeOrders
})

const handleStorageUpdate = () => {
  loadOrders()
  loadHistory()
}

onMounted(() => {
  loadOrders()
  loadHistory()
  window.addEventListener('storage', handleStorageUpdate)
  
  // Real-Time Socket.IO Kitchen Room synchronization
  try {
    const socket = getSocket()
    socket.on('order.created', () => {
      loadOrders()
    })
    socket.on('order.status.updated', () => {
      loadOrders()
    })
  } catch (socketErr) {
    console.warn('Socket listener setup notice:', socketErr)
  }

  // Auto-refresh interval in case reactive storage event is lost across pages
  const syncInterval = setInterval(() => {
    loadOrders()
    loadHistory()
  }, 2500)
  
  // Real-time ticker to trigger computed property update and auto-archive
  const timeTicker = setInterval(() => {
    currentTime.value = Date.now()
    
    let hasArchived = false
    orders.value.forEach(order => {
      if (order.status === 'Served' && order.servedAt) {
        const elapsed = currentTime.value - order.servedAt
        if (elapsed >= 60000) {
          const existsInHist = ticketHistory.value.some((h: any) => h.id === order.id)
          if (!existsInHist) {
            ticketHistory.value.unshift({
              id: order.id,
              name: order.name,
              price: order.price,
              quantity: order.quantity,
              tableNo: order.tableNo || '12B',
              customizations: order.customizations || 'Standard Portions',
              customizedDetails: order.customizedDetails || [],
              servedAt: order.servedAt,
              status: 'Served'
            })
            hasArchived = true
          }
        }
      }
    })
    
    if (hasArchived) {
      saveHistory()
      orders.value = orders.value.filter(order => {
        if (order.status === 'Served' && order.servedAt) {
          return (currentTime.value - order.servedAt) < 60000
        }
        return true
      })
      saveOrders()
      window.dispatchEvent(new Event('storage'))
    }
  }, 1000)

  onUnmounted(() => {
    clearInterval(syncInterval)
    clearInterval(timeTicker)
    window.removeEventListener('storage', handleStorageUpdate)
  })
})

const handleManualOrder = () => {
  // Let the Chef simulate/add test customized food order quickly for validation
  const testId = Date.now()
  const customOrder: OrderItem = {
    id: testId,
    name: 'Cheese Burger',
    price: 12.50,
    quantity: 1,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_58biya1paABTH6IL_cgl_57LeZ4J5ymsHNKEy_VgPxuOxJsNzXiFFL135exa1t8AFxAE6I2fw5HKu9sHfNi9f41xaGgw4NHdDHoFGJ3h0leJQEHhoHysmGLRxhQglZXOUTufuK9mHEbWp_8WFmSd3I687QvKMW_7--1nuVG5f9exmfqQTX38IjGOQI0saGNCydZ5B9nsRTYYoocZY18TGGQzVSVqgxv7r-xbwN3vB_Ia08uSSmBQQ3u1IkcUBkKEXrguPvWYPwE',
    status: 'Preparing',
    customizations: 'Double Cheddar: 2 -> 4 pcs, Beef Patty: 1 -> 2 pcs',
    customizedDetails: [
      { name: 'Double Cheddar', originalAmount: 2, amount: 4, unit: 'pcs', diff: 2, isIncrease: true },
      { name: 'Beef Patty', originalAmount: 1, amount: 2, unit: 'pcs', diff: 1, isIncrease: true }
    ],
    timePlaced: 'Just now',
    tableNo: '08'
  }
  orders.value.push(customOrder)
  saveOrders()
  showToast('Test order with CUSTOM adjustments generated!')
  window.dispatchEvent(new Event('storage'))
}
</script>

<template>
  <div class="bg-surface-bright text-on-surface min-h-screen">
    <!-- Header Section -->
    <header class="w-full h-20 sticky top-0 z-40 bg-white border-b border-surface-variant flex items-center justify-between px-6 md:px-8 gap-4">
      <div class="flex items-center gap-3">
        <h2 class="text-2xl font-black text-on-surface tracking-tight">TosEat.</h2>
        <span class="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0">
          {{ currentLang === 'km' ? 'ប្រព័ន្ធបញ្ជាការងារចុងភៅ KDS' : 'KDS Food Queue' }}
        </span>
      </div>
      
      <div class="relative w-full max-w-sm hidden sm:block">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline-variant">search</span>
        <input 
          v-model="searchQuery"
          type="text" 
          :placeholder="currentLang === 'km' ? 'ស្វែងរកសំបុត្រកម្ម៉ង់ / តុ / ម្ហូប...' : 'Search Tickets / Tables / Items...'"
          class="w-full pl-11 pr-4 py-2 bg-surface-container-low border-0 rounded-full font-bold text-xs focus:ring-2 focus:ring-primary-container outline-none"
        />
      </div>
      
      <div class="flex items-center gap-4 shrink-0">
        <!-- Language Switcher segmented toggle -->
        <div class="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 shadow-sm rounded-full p-0.5 transition-all">
          <button 
            @click="setLang('en')" 
            class="px-2.5 py-1 text-[10px] font-black rounded-full transition-all"
            :class="currentLang === 'en' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            EN
          </button>
          <button 
            @click="setLang('km')" 
            class="px-2.5 py-1 text-[10px] font-black rounded-full transition-all"
            :class="currentLang === 'km' ? 'bg-primary text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'"
          >
            ខ្មែរ
          </button>
        </div>

        <button 
          @click="handleLogout" 
          class="flex items-center gap-2 px-3 py-2 rounded-xl text-secondary hover:text-error hover:bg-rose-50/50 transition-all text-xs sm:text-sm font-bold shrink-0 cursor-pointer"
        >
          <span class="material-symbols-outlined text-base">logout</span>
          <span>{{ currentLang === 'km' ? 'ប្តូរគណនី' : 'Switch Account' }}</span>
        </button>

        <div class="h-8 w-px bg-surface-variant/70 hidden sm:block"></div>

        <div class="hidden sm:flex flex-col items-end mr-1">
          <span class="font-black text-xs text-on-surface text-right leading-none">Alex Thompson</span>
          <span class="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider mt-1">{{ t('role_chef') }}</span>
        </div>
        <div class="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-container shrink-0">
          <img 
            class="w-full h-full object-cover" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCqh_PdnEEE3Gar57ihnjmNqcQ05WBgHmSoCWsAgthrix0XM4xUXFLXoOwOYufXLJx0pHAvh7DzlocuPV_Wh1L2I5fZdNzP0iD2Lg5yg819HAp7Z54d81RbcuO6eHvIgcFnK-HDAHhR6-T4sksEQSIxTVXbGMmEh_FmuFtPMARza3Q46EadWMj2kn8_DRdOFVii5T5uyhpC51CrZhaFpzA7SZAg9O98b0RH3W_bU_0Ks5j1t2mDKssGWYepUxw01VVhucO3r0GEjNI" 
            alt="Chef Alex"
          />
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      <!-- Welcome Header -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <nav class="flex gap-2 mb-2 text-[10px] font-black uppercase text-on-surface-variant tracking-wider">
            <span>{{ currentLang === 'km' ? 'កិច្ចការងារផ្ទះបាយ' : 'Kitchen operations' }}</span>
            <span>/</span>
            <span class="text-primary font-black">{{ currentLang === 'km' ? 'ប្រព័ន្ធបញ្ញើការ KDS' : 'Kitchen Display System (KDS)' }}</span>
          </nav>
          <h1 class="text-3xl font-black text-on-surface tracking-tight">{{ currentLang === 'km' ? 'ផ្ទាំងត្រួតពិនិត្យផ្ទះបាយ' : 'Kitchen Display System Queue' }}</h1>
          <p class="text-xs font-semibold text-on-surface-variant mt-0.5">
            {{ currentLang === 'km' ? 'ការបញ្ជូនបញ្ជាកុម្ម៉ង់ផ្ទាល់ពីតុទៅកាន់ផ្ទះបាយ' : 'Live table-to-kitchen routing' }}  •  
            <span class="text-emerald-700 font-extrabold uppercase">{{ currentLang === 'km' ? 'ផ្នែកចម្អិនសកម្ម' : 'Hot Station Active' }}</span>
          </p>
        </div>
        
        <div class="flex items-center gap-3">
        </div>
      </section>

      <!-- Statistics Bar -->
      <section id="stats-overview" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-white p-5 rounded-2xl border border-surface-variant/70 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <span class="text-[10px] uppercase font-black tracking-wider text-outline">{{ currentLang === 'km' ? 'សំបុត្រកម្ម៉ង់សកម្ម' : 'Active Tickets' }}</span>
            <p class="text-2xl font-black text-on-surface">{{ activeCount }}</p>
          </div>
          <span class="p-3 bg-amber-50 text-amber-700 rounded-xl material-symbols-outlined">timer</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-surface-variant/70 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <span class="text-[10px] uppercase font-black tracking-wider text-outline">{{ currentLang === 'km' ? 'រយៈពេលរៀបចំមធ្យម' : 'Avg. prep time' }}</span>
            <p class="text-2xl font-black text-on-surface">{{ avgPrepTime }} {{ currentLang === 'km' ? 'នាទី' : 'min' }}</p>
          </div>
          <span class="p-3 bg-emerald-50 text-emerald-700 rounded-xl material-symbols-outlined">avg_pace</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-surface-variant/70 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <span class="text-[10px] uppercase font-black tracking-wider text-outline">{{ currentLang === 'km' ? 'ជួរកំពុងចម្អិន' : 'Cooking Queue' }}</span>
            <p class="text-2xl font-black text-on-surface">{{ readyToServeCount }}</p>
          </div>
          <span class="p-3 bg-blue-50 text-blue-700 rounded-xl material-symbols-outlined">oven_gen</span>
        </div>

        <div class="bg-white p-5 rounded-2xl border border-surface-variant/70 shadow-xs flex items-center justify-between">
          <div class="space-y-1">
            <span class="text-[10px] uppercase font-black tracking-wider text-outline">{{ currentLang === 'km' ? 'បានបម្រើថ្ងៃនេះ' : 'Served Today' }}</span>
            <p class="text-2xl font-black text-on-surface">{{ servedCount }}</p>
          </div>
          <span class="p-3 bg-stone-100 text-stone-700 rounded-xl material-symbols-outlined">restaurant</span>
        </div>
      </section>

      <!-- Filter Controls -->
      <div id="filter-chips" class="flex flex-wrap items-center gap-2">
        <button 
          v-for="f in ['All', 'Pending', 'Preparing', 'Served', 'Customized']"
          :key="f"
          @click="selectedFilter = f"
          class="px-4 py-2 rounded-full font-black text-xs transition-all border outline-none"
          :class="[
            selectedFilter === f 
              ? 'bg-primary border-primary text-white shadow-md' 
              : 'bg-white border-outline-variant/60 text-on-surface-variant hover:bg-surface-container-low'
          ]"
        >
          {{ 
            f === 'All' ? (currentLang === 'km' ? `ការកុម្ម៉ង់ទាំងអស់ (${orders.length})` : `All Orders (${orders.length})`) :
            f === 'Pending' ? (currentLang === 'km' ? 'មិនទាន់រៀបចំ (Pending)' : 'Pending') :
            f === 'Preparing' ? (currentLang === 'km' ? 'កំពុងចម្អិន (Cooking)' : 'Preparing') :
            f === 'Served' ? (currentLang === 'km' ? 'បានបម្រើ (Served)' : 'Served') :
            f === 'Customized' ? (currentLang === 'km' ? 'កែសម្រួលគ្រឿងផ្សំ' : 'Customized') : f
          }}
        </button>
      </div>

      <!-- KDS Queue Cards Grid -->
      <section class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <article 
          v-for="order in filteredOrders" 
          :key="order.id"
          class="bg-white rounded-[24px] border-2 flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md transition-all h-full"
          :class="[
            order.status === 'Served' ? 'border-emerald-500/20 opacity-80' : 
            order.status === 'Sent to Kitchen' ? 'border-blue-500/60' :
            order.customizedDetails && order.customizedDetails.length > 0 ? 'border-amber-500 bg-amber-50/[0.01]' : 'border-surface-variant'
          ]"
        >
          <!-- Card Header & Metadata -->
          <div 
            class="p-5 border-b border-surface-variant/40 flex justify-between items-start"
            :class="[
              order.status === 'Served' ? 'bg-emerald-50/50' : 
              order.status === 'Sent to Kitchen' ? 'bg-blue-50/50' :
              order.customizedDetails && order.customizedDetails.length > 0 ? 'bg-amber-100/40' : 'bg-surface-container-low'
            ]"
          >
            <div class="flex items-center gap-3">
              <div class="bg-on-surface text-white w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black">
                <span class="text-[8px] uppercase tracking-wide opacity-70">{{ currentLang === 'km' ? 'តុ' : 'Table' }}</span>
                <span class="text-base leading-tight">{{ order.tableNo }}</span>
              </div>
              <div>
                <h3 class="font-black text-xs text-on-surface">{{ currentLang === 'km' ? 'សំបុត្រកម្ម៉ង់ #' : 'Ticket #ORD-' }}{{ order.id % 10000 }}</h3>
                <div class="flex items-center gap-1 text-[10px] text-outline mt-0.5 font-bold">
                  <span class="material-symbols-outlined text-[12px] font-black">schedule</span>
                  <span>{{ order.timePlaced }}</span>
                </div>
              </div>
            </div>

            <span 
              class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider"
              :class="[
                order.status === 'Served' ? 'bg-emerald-100 text-emerald-800' :
                order.status === 'Sent to Kitchen' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
              ]"
            >
              {{ 
                order.status === 'Preparing' ? (currentLang === 'km' ? 'កំពុងរៀបចំ' : 'Preparing') :
                order.status === 'Sent to Kitchen' ? (currentLang === 'km' ? 'កំពុងចម្អិន' : 'Cooking') :
                order.status === 'Served' ? (currentLang === 'km' ? 'បានបម្រើ' : 'Served') : order.status
              }}
            </span>
          </div>

          <!-- Card Content / Recipe / Order Quantities -->
          <div class="p-5 flex-1 space-y-4">
            <!-- Order row details -->
            <div class="flex gap-4">
              <span class="text-xl font-black text-primary">x{{ order.quantity }}</span>
              <div class="flex-1">
                <h4 class="font-black text-[15px] text-on-surface">{{ translateDishName(order.name) }}</h4>
                <p class="text-[11px] text-outline font-bold mt-0.5">${{ order.price.toFixed(2) }} {{ currentLang === 'km' ? 'ក្នុងមួយមុខ' : 'each' }}</p>
              </div>
              <img v-if="order.image" :src="order.image" class="w-12 h-12 object-cover rounded-lg border shrink-0" />
            </div>

            <!-- CUSTOM PORTION ALERTS section - highlight customers' extra ingredient requests! -->
            <div class="border-t border-dashed border-outline-variant/50 pt-4 mt-2">
              <div v-if="order.customizedDetails && order.customizedDetails.length > 0" class="space-y-2">
                <!-- Highlight alert header -->
                <div class="bg-amber-50 border border-amber-200 p-2.5 rounded-xl flex items-start gap-2">
                  <span class="material-symbols-outlined text-amber-700 text-base shrink-0 mt-0.5">warning</span>
                  <div>
                    <h5 class="text-[10px] font-black uppercase text-amber-800 tracking-wider">
                      {{ currentLang === 'km' ? '⚠️ ភ្ញៀវសុំកែសម្រួលគ្រឿងផ្សំ' : '⚠️ Recipe Adjusted by Customer' }}
                    </h5>
                    <p class="text-[9px] font-bold text-amber-700/90 leading-tight">
                      {{ currentLang === 'km' ? 'ទាមទារការផ្លាស់ប្តូរគ្រឿងផ្សំពេលផ្សំមុខម្ហូប៖' : 'Requires recipe modification during assembly:' }}
                    </p>
                  </div>
                </div>

                <!-- Portions list -->
                <div class="grid grid-cols-1 gap-1 pl-1">
                  <div 
                    v-for="(detail, ix) in order.customizedDetails" 
                    :key="ix"
                    class="flex items-center justify-between text-[11px] py-1.5 px-2.5 rounded-lg border font-bold"
                    :class="detail.isIncrease ? 'bg-emerald-50/80 text-emerald-900 border-emerald-200' : 'bg-rose-50/80 text-rose-900 border-rose-200'"
                  >
                    <span class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-sm font-black">{{ detail.isIncrease ? 'add' : 'remove' }}</span>
                      {{ translateIngredient(detail.name) }}
                    </span>
                    <span class="text-[10px] font-black uppercase">
                      {{ detail.isIncrease ? (currentLang === 'km' ? 'បន្ថែម' : 'Add More') : (currentLang === 'km' ? 'បន្ថយត្រឹម' : 'Reduce To') }}: 
                      <span class="bg-white py-0.5 px-1.5 rounded shadow-xs ml-1 border font-black text-on-surface">
                        {{ detail.amount }} {{ currentLang === 'km' && detail.unit === 'pcs' ? 'គ្រាប់/ដុំ' : currentLang === 'km' && detail.unit === 'portions' ? 'ចំណែក' : detail.unit }}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <!-- Fallback customization string if simple -->
              <div v-else-if="order.customizations && order.customizations !== 'Standard Portions'" class="bg-amber-50/60 p-3 rounded-xl border border-amber-200 font-bold">
                <span class="text-[9px] font-black uppercase text-amber-800">{{ currentLang === 'km' ? 'ការណែនាំបន្ថែមរបស់ភ្ញៀវ' : 'Special Instructions' }}</span>
                <p class="text-[11px] font-bold text-on-surface mt-0.5 opacity-90 leading-relaxed">{{ order.customizations }}</p>
              </div>

              <!-- Standard Ingredients -->
              <div v-else class="p-3 bg-surface-container-low rounded-xl text-center border border-dashed border-outline-variant/60">
                <span class="text-[9px] font-black uppercase text-outline tracking-wider">{{ currentLang === 'km' ? 'រូបមន្តស្តង់ដារ' : 'Standard Recipe' }}</span>
                <p class="text-[11px] text-outline font-bold mt-0.5">{{ currentLang === 'km' ? 'រៀបចំដំឡើងតាមកម្រិតធម្មតា' : 'Prepare standard portion plates' }}</p>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons for the Chef -->
          <div class="p-5 border-t border-surface-variant/40 bg-white flex gap-2">
            <button 
              @click="notifyDelay(order.tableNo, order.id)"
              class="w-10 h-10 flex items-center justify-center border border-amber-300 text-amber-600 hover:bg-amber-50 hover:border-amber-400 rounded-xl transition-all cursor-pointer"
              :title="currentLang === 'km' ? 'ជម្រាបជូនដំណឹងយឺតយ៉ាវទៅតុ' : 'Notify Table of Delay'"
            >
              <span class="material-symbols-outlined text-base">schedule</span>
            </button>

            <!-- Status action button -->
            <button 
              v-if="order.status === 'Preparing'"
              @click="updateStatus(order.id, 'Sent to Kitchen')"
              class="flex-1 py-2.5 bg-white border border-primary text-primary hover:bg-primary/5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              <span class="material-symbols-outlined text-sm font-black">cooking</span>
              {{ currentLang === 'km' ? 'ចាប់ផ្តើមចម្អិន' : 'Start Cooking' }}
            </button>

            <button 
              v-else-if="order.status === 'Sent to Kitchen'"
              @click="updateStatus(order.id, 'Served')"
              class="flex-1 py-2.5 bg-primary text-white hover:bg-opacity-95 rounded-xl font-black text-xs shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-1 cursor-pointer animate-pulse animate-duration-1000"
            >
              <span class="material-symbols-outlined text-sm font-black">check_circle</span>
              {{ currentLang === 'km' ? 'ចម្អិនរួចរាល់ / ជូនទៅភ្ញៀវ' : 'Dispatch / Serve' }}
            </button>

            <button 
              v-else
              @click="archiveOrder(order.id)"
              class="flex-1 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-250 hover:border-emerald-350 rounded-xl font-black text-xs flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98]"
              :title="currentLang === 'km' ? 'រក្សាទុកក្នុងប្រវត្តិភ្លាមៗ' : 'Click to archive immediately'"
            >
              <span class="material-symbols-outlined text-sm font-bold">done_all</span>
              {{ currentLang === 'km' ? 'បានបម្រើ & រក្សាទុកកិច្ចការ' : 'Served & Finished' }}
            </button>
          </div>
        </article>
      </section>

      <!-- Full Historical Order List Grouped by Day -->
      <section class="bg-white rounded-[24px] border border-surface-variant/70 shadow-xs overflow-hidden font-bold">
        <div class="px-6 py-5 border-b border-surface-variant flex justify-between items-center bg-surface-container-low">
          <div>
            <h3 class="font-black text-sm text-on-surface uppercase tracking-wide">{{ currentLang === 'km' ? 'ប្រវត្តិនៃការចម្អិនសំបុត្រកម្ម៉ង់ថ្មីៗ' : 'Recent Ticket Activity History' }}</h3>
            <p class="text-[10px] text-outline font-semibold mt-0.5">{{ currentLang === 'km' ? 'បញ្ជីរបាយការណ៍ដែលបានបញ្ចប់រួចរាលចាត់ចែងតាមកាលបរិច្ឆេទ' : 'Comprehensive logged activity archives grouped by completion date' }}</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-black text-outline bg-white px-2.5 py-1 border rounded-lg shadow-3xs">
              {{ ticketHistory.length }} {{ currentLang === 'km' ? 'សំបុត្រត្រូវបានរក្សាទុក' : 'items archived' }}
            </span>
            <button 
              @click="clearHistory" 
              class="px-2.5 py-1 text-[10px] hover:bg-rose-50 border border-rose-250 hover:border-rose-300 text-rose-600 rounded-lg font-black uppercase transition-all whitespace-nowrap"
              :title="currentLang === 'km' ? 'សំអាតប្រវត្តិទាំងអស់' : 'Reset history logs'"
            >
              {{ currentLang === 'km' ? 'សម្អាតបញ្ជីប្រវត្តិ' : 'Clear Logs' }}
            </button>
          </div>
        </div>
        
        <div class="divide-y divide-surface-container/60 bg-white">
          <div v-for="(dayOrders, dayLabel) in groupedHistory" :key="dayLabel" class="p-5 md:p-6 space-y-4">
            <!-- Day Header Badge -->
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base font-black">calendar_today</span>
              <h4 class="font-black text-xs text-on-surface uppercase tracking-wider bg-slate-100/80 px-3 py-1.5 rounded-lg border border-slate-200/60 shadow-3xs">
                {{ dayLabel }}
              </h4>
              <span class="text-[10px] font-bold text-outline">
                ({{ dayOrders.length }} {{ currentLang === 'km' ? 'មុខម្ហូប' : 'item' }}{{ dayOrders.length > 1 && currentLang !== 'km' ? 's' : '' }})
              </span>
            </div>

            <!-- Table or list of completed orders of this day -->
            <div class="overflow-x-auto rounded-xl border border-surface-variant/40 bg-slate-50/[0.15]">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-surface-container-low/40 border-b border-surface-variant/40">
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'លេខសំបុត្រ' : 'Ticket ID' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'លេខតុ' : 'Table' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'ឈ្មោះម្ហូប' : 'Dish' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'ព័ត៌មានលម្អិត' : 'Adjustments info' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'ចំនួន' : 'Quantity' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'ម៉ោងជូនភ្ញៀវ' : 'Served Time' }}</th>
                    <th class="px-6 py-3 text-[10px] uppercase font-black text-outline">{{ currentLang === 'km' ? 'ស្ថានភាព' : 'Status' }}</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-surface-container/60">
                  <tr 
                    v-for="order in dayOrders" 
                    :key="'hist-' + order.id" 
                    class="hover:bg-white bg-white/70 transition-colors font-bold text-xs"
                  >
                    <td class="px-6 py-3.5 font-black text-primary">#ORD-{{ order.id % 10000 }}</td>
                    <td class="px-6 py-3.5">
                      <span class="bg-slate-100 text-slate-700 border border-slate-200/60 px-2 py-0.5 rounded text-[10px] font-black">
                        {{ currentLang === 'km' ? 'តុ' : 'Table' }} {{ order.tableNo }}
                      </span>
                    </td>
                    <td class="px-6 py-3.5 text-on-surface font-black">
                      <div class="flex items-center gap-2">
                        <span>{{ translateDishName(order.name) }}</span>
                        <span class="text-[10px] text-outline font-bold">${{ order.price.toFixed(2) }}</span>
                      </div>
                    </td>
                    <td class="px-6 py-3.5">
                      <span 
                        class="px-2.5 py-1 rounded text-[10px]"
                        :class="order.customizedDetails && order.customizedDetails.length > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-50 text-outline border border-slate-100'"
                      >
                        {{ order.customizedDetails && order.customizedDetails.length > 0 
                          ? (currentLang === 'km' ? `កែសម្រួល (${order.customizedDetails.length} មុខគ្រឿង)` : `Custom (${order.customizedDetails.length} changed)`) 
                          : (currentLang === 'km' ? 'រូបមន្តស្តង់ដារ' : 'Standard Portions') 
                        }}
                      </span>
                    </td>
                    <td class="px-6 py-3.5">x{{ order.quantity }}</td>
                    <td class="px-6 py-3.5 text-outline font-black">
                      {{ new Date(order.servedAt).toLocaleTimeString(currentLang === 'km' ? 'kh-KH' : 'en-US', { hour: '2-digit', minute: '2-digit' }) }}
                    </td>
                    <td class="px-6 py-3.5">
                      <span class="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-250">
                        {{ currentLang === 'km' ? 'បានបញ្ចប់' : 'Completed' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="ticketHistory.length === 0" class="text-center py-12 text-outline bg-slate-50/20 font-bold">
            <span class="material-symbols-outlined text-outline/65 text-4xl mb-2">archive</span>
            <p class="text-xs font-black text-on-surface-variant">{{ currentLang === 'km' ? 'មិនទាន់មានប្រវត្តិនៃការចម្អិនដែលបានរក្សាទុកនៅឡើយទេ។' : 'No completed tickets in history logs yet.' }}</p>
            <p class="text-[10px] text-outline font-semibold mt-1">
              {{ currentLang === 'km' ? 'សំបុត្រដែលបានបម្រើជូនភ្ញៀវនឹងត្រូវបាត់ពីបញ្ជីបន្ទាប់ពីរយៈពេល៦០វិនាទី ហើយនឹងចូលមកកាន់ប្រវត្តិទីនេះដោយស្វ័យប្រវត្ត។' : 'Served tickets disappear from the queue after 60s (or when manual archived) and move here grouped by date.' }}
            </p>
          </div>
        </div>
      </section>
    </main>

    <!-- FLOATING ACTIONS TOAST -->
    <div 
      v-if="isToastVisible"
      class="fixed bottom-6 right-6 bg-inverse-surface text-inverse-on-surface px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 text-xs font-black animate-in fade-in slide-in-from-bottom-5 duration-300"
    >
      <span class="material-symbols-outlined text-primary-fixed-dim text-base">info</span>
      <span>{{ alertToastMessage }}</span>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #d5c4ab;
  border-radius: 10px;
}
</style>
