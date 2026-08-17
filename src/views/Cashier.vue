<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { t, currentLang, setLang, translateDishName } from '../i18n'
import { orderService } from '../services/orders'
import { tableService } from '../services/tables'
import { getSocket } from '../services/socket'
import { logout } from '../services/auth'

const router = useRouter()

const handleLogout = async () => {
  await logout()
  router.push('/')
}

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  image: string
  status: string
  customizations: string
  customizedDetails?: any[]
  tableNo: string
  customerName?: string
  paymentStatus?: 'Unpaid' | 'Pending' | 'Paid'
  timePlaced?: string
}

interface SettleTransaction {
  id: string
  timestamp: number
  tableNo: string
  customerName: string
  items: { name: string; price: number; quantity: number }[]
  subtotal: number
  tax: number
  serviceFee: number
  total: number
  paymentMethod: 'Cash' | 'Credit Card' | 'Mobile Pay'
  cashReceived?: number
  changeDue?: number
}

// Standard active orders list, shared with Menu and Chef
const activeOrders = ref<OrderItem[]>([])
// Saved cashier transactions list
const transactions = ref<SettleTransaction[]>([])

const selectedTable = ref<string | null>(null)
const selectedPaymentMethod = ref<'Cash' | 'Credit Card' | 'Mobile Pay'>('Cash')
const amountPaid = ref<string>('')
const toastMessage = ref<string | null>(null)
const showReceiptModal = ref<boolean>(false)
const viewingReceipt = ref<SettleTransaction | null>(null)
const filterStatus = ref<'All' | 'Unpaid' | 'Pending'>('All')
const searchQuery = ref<string>('')

// Custom Confirmation modal state
const isConfirmOpen = ref(false)
const confirmTitle = ref('')
const confirmMessage = ref('')
const confirmOnYes = ref<(() => void) | null>(null)

const askConfirmation = (title: string, message: string, onYes: () => void) => {
  confirmTitle.value = title
  confirmMessage.value = message
  confirmOnYes.value = onYes
  isConfirmOpen.value = true
}

const execConfirmYes = () => {
  if (confirmOnYes.value) {
    confirmOnYes.value()
  }
  isConfirmOpen.value = false
  confirmOnYes.value = null
}

// Play sound indicator or visual notification
const lastPendingCount = ref(0)

const showToast = (msg: string) => {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = null
    }
  }, 4000)
}

// Group active items by table number
const tableSessions = computed(() => {
  const groups: { [key: string]: { tableNo: string; name: string; items: OrderItem[]; total: number; isPending: boolean; status: 'Unpaid' | 'Pending' } } = {}

  activeOrders.value.forEach((o: any) => {
    const table = o.tableNo || '12B'
    const status = o.paymentStatus || 'Unpaid'
    const name = o.customerName || `Table ${table} Guest`
    const isPending = status === 'Pending'

    if (!groups[table]) {
      groups[table] = {
        tableNo: table,
        name: name,
        items: [],
        total: 0,
        isPending: false,
        status: 'Unpaid'
      }
    }

    // Set Name if it is customized, otherwise keep existing
    if (o.customerName && !groups[table].name.startsWith('Guest')) {
      groups[table].name = o.customerName
    }

    groups[table].items.push(o)
    if (status === 'Pending') {
      groups[table].isPending = true
      groups[table].status = 'Pending'
    }
  })

  // Calculate totals and apply formulas: Subtotal + 10% Tax + 5% Service Fee
  Object.keys(groups).forEach(table => {
    const subtotal = groups[table].items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    const tax = subtotal * 0.10
    const serviceFee = subtotal * 0.05
    groups[table].total = +(subtotal + tax + serviceFee).toFixed(2)
  })

  // Convert to array
  let list = Object.values(groups)

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase().trim()
    list = list.filter(s => s.tableNo.toLowerCase().includes(query) || s.name.toLowerCase().includes(query))
  }

  // Status filter
  if (filterStatus.value === 'Unpaid') {
    list = list.filter(s => !s.isPending)
  } else if (filterStatus.value === 'Pending') {
    list = list.filter(s => s.isPending)
  }

  return list
})

const selectedSession = computed(() => {
  if (!selectedTable.value) return null
  return tableSessions.value.find(s => s.tableNo === selectedTable.value) || null
})

// Calculations for currently selected session
const subtotalVal = computed(() => {
  if (!selectedSession.value) return 0
  return selectedSession.value.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
})

const taxVal = computed(() => {
  return +(subtotalVal.value * 0.10).toFixed(2)
})

const serviceFeeVal = computed(() => {
  return +(subtotalVal.value * 0.05).toFixed(2)
})

const grandTotalVal = computed(() => {
  return +(subtotalVal.value + taxVal.value + serviceFeeVal.value).toFixed(2)
})

// Auto cash calculator helper variables
const cashReceivedNum = computed(() => {
  const num = parseFloat(amountPaid.value)
  return isNaN(num) ? 0 : num
})

const changeDueNum = computed(() => {
  if (selectedPaymentMethod.value !== 'Cash') return 0
  if (cashReceivedNum.value < grandTotalVal.value) return 0
  return +(cashReceivedNum.value - grandTotalVal.value).toFixed(2)
})

// Presets for cash payment
const addPresetCash = (amount: number) => {
  if (amount === 0) {
    amountPaid.value = grandTotalVal.value.toFixed(2)
  } else {
    const current = parseFloat(amountPaid.value) || 0
    amountPaid.value = (current + amount).toString()
  }
}

const clearCash = () => {
  amountPaid.value = ''
}

// Load values state
const localStorageKey = 'gomeal_customer_orders'
const localStorageHistoryKey = 'gomeal_payout_history'

const loadData = () => {
  // Load Active orders
  const stored = localStorage.getItem(localStorageKey)
  if (stored) {
    try {
      activeOrders.value = JSON.parse(stored)
    } catch (e) {
      console.error(e)
    }
  } else {
    // Seed standard table orders if empty so there is fully functioning playground!
    const defaults: OrderItem[] = [
      {
        id: 101,
        name: 'Cheese Burger',
        price: 12.50,
        quantity: 2,
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400',
        status: 'Served',
        customizations: 'Double Cheddar: 2 -> 3 pcs',
        tableNo: '12B',
        customerName: 'Sophy Moeurn',
        paymentStatus: 'Pending', // pending is amber blinking
        timePlaced: '10 mins ago'
      },
      {
        id: 102,
        name: 'French Fries',
        price: 5.50,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=400',
        status: 'Served',
        customizations: 'Standard Portions',
        tableNo: '12B',
        customerName: 'Sophy Moeurn',
        paymentStatus: 'Pending',
        timePlaced: '8 mins ago'
      },
      {
        id: 103,
        name: 'Club Sandwich',
        price: 9.80,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1567237018192-fde9467ee733?auto=format&fit=crop&q=80&w=400',
        status: 'Preparing',
        customizations: 'Whole Wheat Bread',
        tableNo: '04',
        customerName: 'Elena Rostova',
        paymentStatus: 'Unpaid', // unpaid is red
        timePlaced: '2 mins ago'
      },
      {
        id: 104,
        name: 'Pepperoni Pizza',
        price: 18.99,
        quantity: 1,
        image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=400',
        status: 'Served',
        customizations: 'Thick Crust, Extra Mozzarella',
        tableNo: '01',
        customerName: 'Daniel Craig',
        paymentStatus: 'Unpaid',
        timePlaced: '25 mins ago'
      },
      {
        id: 105,
        name: 'Coca Cola',
        price: 2.50,
        quantity: 3,
        image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&q=80&w=400',
        status: 'Served',
        customizations: 'Standard Ice portions',
        tableNo: '01',
        customerName: 'Daniel Craig',
        paymentStatus: 'Unpaid',
        timePlaced: '20 mins ago'
      }
    ]
    localStorage.setItem(localStorageKey, JSON.stringify(defaults))
    activeOrders.value = defaults
  }

  // Load transaction reports
  const storedHist = localStorage.getItem(localStorageHistoryKey)
  if (storedHist) {
    try {
      transactions.value = JSON.parse(storedHist)
    } catch (e) {
      console.error(e)
    }
  } else {
    // Seed default payment history for visual rhythm
    const somePastDate = Date.now() - 3600000 * 3
    const seededTransactions: SettleTransaction[] = [
      {
        id: 'TXN-94185',
        timestamp: somePastDate,
        tableNo: '08',
        customerName: 'Chef Marc',
        items: [
          { name: 'Berry Smoothie', price: 7.50, quantity: 2 },
          { name: 'Vegan Bowl', price: 14.20, quantity: 1 }
        ],
        subtotal: 29.20,
        tax: 2.92,
        serviceFee: 1.46,
        total: 33.58,
        paymentMethod: 'Credit Card'
      },
      {
        id: 'TXN-93451',
        timestamp: somePastDate - 14400000,
        tableNo: '02',
        customerName: 'Aria Montgomery',
        items: [
          { name: 'Cheese Burger', price: 12.50, quantity: 1 },
          { name: 'French Fries', price: 5.50, quantity: 1 }
        ],
        subtotal: 18.00,
        tax: 1.80,
        serviceFee: 0.90,
        total: 20.70,
        paymentMethod: 'Cash',
        cashReceived: 30.00,
        changeDue: 9.30
      }
    ]
    localStorage.setItem(localStorageHistoryKey, JSON.stringify(seededTransactions))
    transactions.value = seededTransactions
  }

  // Check for any new pending bills and alert
  const pendingCount = activeOrders.value.filter((o: any) => o.paymentStatus === 'Pending').length
  if (pendingCount > lastPendingCount.value) {
    const alertMsg = currentLang.value === 'km'
      ? `🔔 ដំណឹង៖ មានអតិថិជនស្នើសុំទូទាត់ប្រាក់! សូមចុចលើតុដើម្បីគិតលុយ។`
      : `🔔 Notice: A guest has requested the bill! Click on the table to process checkout.`
    showToast(alertMsg)
  }
  lastPendingCount.value = pendingCount
}

const saveData = () => {
  localStorage.setItem(localStorageKey, JSON.stringify(activeOrders.value))
}

const saveTransactions = () => {
  localStorage.setItem(localStorageHistoryKey, JSON.stringify(transactions.value))
}

// Complete checkout payment process
const settleBill = async () => {
  if (!selectedSession.value) return

  const total = grandTotalVal.value
  const session = selectedSession.value

  // Input check for cash payments
  if (selectedPaymentMethod.value === 'Cash') {
    if (cashReceivedNum.value < total) {
      const errNoCash = currentLang.value === 'km'
        ? `⚠️ ចំនួនលុយមិនគ្រប់គ្រាន់ទេ។ ចំនួនសរុបគឺ $${total.toFixed(2)}។`
        : `⚠️ Insufficient cash amount. Grand total is $${total.toFixed(2)}.`
      showToast(errNoCash)
      return
    }
  }

  // Call backend payTable API
  try {
    await orderService.payTable(session.tableNo)
  } catch (apiErr) {
    console.log('Cashier backend payment API notice:', apiErr)
  }

  // Build payout invoice receipt record
  const newTx: SettleTransaction = {
    id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
    timestamp: Date.now(),
    tableNo: session.tableNo,
    customerName: session.name,
    items: session.items.map(i => ({
      name: i.name,
      price: i.price,
      quantity: i.quantity
    })),
    subtotal: subtotalVal.value,
    tax: taxVal.value,
    serviceFee: serviceFeeVal.value,
    total: total,
    paymentMethod: selectedPaymentMethod.value,
    cashReceived: selectedPaymentMethod.value === 'Cash' ? cashReceivedNum.value : undefined,
    changeDue: selectedPaymentMethod.value === 'Cash' ? changeDueNum.value : undefined
  }

  // 1. Save transactional record
  transactions.value.unshift(newTx)
  saveTransactions()

  // 2. Remove settled active orders from local storage queue so the table resets
  activeOrders.value = activeOrders.value.filter((o: any) => o.tableNo !== session.tableNo)
  saveData()

  // 3. Clear interactive state
  const completedTable = session.tableNo
  selectedTable.value = null
  amountPaid.value = ''
  
  // 4. Open Receipt screen
  viewingReceipt.value = newTx
  showReceiptModal.value = true

  const successSettle = currentLang.value === 'km'
    ? `✅ បានទូទាត់ប្រាក់រួចរាល់! តុលេខ ${completedTable} ត្រូវបានសំអាត និងរៀបចំសម្រាប់ភ្ញៀវថ្មី។`
    : `✅ Bill happily paid! Table ${completedTable} is now cleared and ready for new guests.`
  showToast(successSettle)
  
  // Force notification storage event to update other clients
  window.dispatchEvent(new Event('storage'))
}

// Refund / Void custom action
const voidTx = (txn: SettleTransaction) => {
  const confirmT = currentLang.value === 'km' ? 'បោះបង់ការទូទាត់' : 'Void Transaction'
  const confirmM = currentLang.value === 'km'
    ? `តើអ្នកប្រាកដជាចង់បោះបង់កំណត់ត្រាការទូទាត់ ${txn.id} មែនទេ? សកម្មភាពនេះនឹងផ្ទេរការកុម្ម៉ង់/វិក្កយបត្រត្រឡប់ទៅតុលេខ ${txn.tableNo} វិញ និងលុបការលក់ចេញពីកំណត់ត្រា។`
    : `Are you sure you want to void transaction report ${txn.id}? This will restore the bill / orders to Table ${txn.tableNo} and remove the sale from logs.`
  
  askConfirmation(
    confirmT,
    confirmM,
    () => {
      // Restore orders to active queue
      const restoredOrders: OrderItem[] = txn.items.map((i, index) => ({
        id: Date.now() + index + Math.floor(Math.random() * 100),
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
        status: 'Served',
        customizations: 'Restored Settle',
        tableNo: txn.tableNo,
        customerName: txn.customerName,
        paymentStatus: 'Unpaid',
        timePlaced: 'Restored just now'
      }))

      activeOrders.value.push(...restoredOrders)
      saveData()

      // Filter out transaction from log list
      transactions.value = transactions.value.filter(t => t.id !== txn.id)
      saveTransactions()

      const voidMsg = currentLang.value === 'km'
        ? `↩️ ការទូទាត់ ${txn.id} ត្រូវបានបោះបង់! វិក្កយបត្រតុលេខ ${txn.tableNo} ត្រូវបានស្តារឡើងវិញ។`
        : `↩️ Transaction ${txn.id} voided! Table ${txn.tableNo} orders restored.`
      showToast(voidMsg)
      window.dispatchEvent(new Event('storage'))
    }
  )
}

const clearAllTransactions = () => {
  const clearT = currentLang.value === 'km' ? 'លុបកំណត់ត្រាទាំងអស់' : 'Clear All Records'
  const clearM = currentLang.value === 'km'
    ? 'តើអ្នកប្រាកដទេថាចង់លុបប្រវត្តិទូទាត់ប្រាក់ទាំងអស់ដោយអចិន្ត្រៃយ៍? សកម្មភាពនេះមិនអាចសង្គ្រោះវិញបានឡើយ។'
    : 'Are you sure you want to permanently clear the entire settlement history? This cannot be undone.'
  
  askConfirmation(
    clearT,
    clearM,
    () => {
      transactions.value = []
      saveTransactions()
      const clearedMsg = currentLang.value === 'km' ? 'បានសម្អាតប្រវត្តិទូទាត់សរុបដោយជោគជ័យ។' : 'Settlement archives cleared successfully.'
      showToast(clearedMsg)
    }
  )
}

// Aggregate Calculations for daily register readout
const todayTotalSales = computed(() => {
  return transactions.value.reduce((sum, tx) => sum + tx.total, 0)
})

const methodBreakdown = computed(() => {
  const summary = { Cash: 0, Card: 0, Mobile: 0 }
  transactions.value.forEach(tx => {
    if (tx.paymentMethod === 'Cash') summary.Cash += tx.total
    else if (tx.paymentMethod === 'Credit Card') summary.Card += tx.total
    else if (tx.paymentMethod === 'Mobile Pay') summary.Mobile += tx.total
  })
  return summary
})

// Auto sync storage listener
const onStorageUpdate = () => {
  loadData()
}

let syncTimer: any = null

onMounted(() => {
  loadData()
  window.addEventListener('storage', onStorageUpdate)
  
  try {
    const socket = getSocket()
    socket.on('order.created', () => {
      loadData()
    })
    socket.on('order.status.updated', () => {
      loadData()
    })
    socket.on('table.status.updated', () => {
      loadData()
    })
  } catch (socketErr) {
    console.log('Socket listener notice in Cashier:', socketErr)
  }

  // Periodic state refresh
  syncTimer = setInterval(loadData, 2000)
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageUpdate)
  if (syncTimer) clearInterval(syncTimer)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800 selection:bg-primary-container selection:text-on-primary-container">
    <!-- Top Cashier Navigation Header -->
    <header class="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <!-- Logo Branding -->
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/25">
            <span class="material-symbols-outlined text-[26px]">point_of_sale</span>
          </div>
          <div>
            <span class="text-[10px] uppercase font-black text-primary tracking-widest bg-primary/10 px-2 py-0.5 rounded">{{ currentLang === 'km' ? 'ម៉ាស៊ីនគិតលុយ' : 'Cash Terminal' }}</span>
            <h1 class="text-xl font-black text-slate-900 flex items-center gap-2">
              {{ currentLang === 'km' ? 'TosEat. បេឡាករ' : 'TosEat. Cashier' }}
            </h1>
          </div>
        </div>

        <!-- Live Cash Drawer State Readout -->
        <div class="flex items-center gap-2 sm:gap-4 flex-wrap justify-center">
          <!-- Language Switcher segmented toggle -->
          <div class="flex items-center gap-0.5 bg-slate-100 hover:bg-slate-200/60 border border-slate-200 shadow-sm rounded-full p-0.5 transition-all">
            <button 
              @click="setLang('en')" 
              class="px-2.5 py-1 text-[10px] font-black rounded-full transition-all outline-none"
              :class="currentLang === 'en' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'"
            >
              EN
            </button>
            <button 
              @click="setLang('km')" 
              class="px-2.5 py-1 text-[10px] font-black rounded-full transition-all outline-none"
              :class="currentLang === 'km' ? 'bg-primary text-white shadow-xs' : 'text-slate-600 hover:text-slate-800'"
            >
              ខ្មែរ
            </button>
          </div>

          <div class="bg-emerald-50 border border-emerald-200/60 rounded-xl px-3 sm:px-4 py-2 text-center shadow-3xs">
            <span class="text-[9px] uppercase font-bold text-emerald-800 tracking-wider block">{{ currentLang === 'km' ? 'ប្រាក់ចំណូលលក់ថ្ងៃនេះ' : "Today's Sales Drawer" }}</span>
            <span class="text-sm sm:text-base font-black text-emerald-700">${{ todayTotalSales.toFixed(2) }}</span>
          </div>

          <div class="bg-blue-50 border border-blue-200/60 rounded-xl px-3 sm:px-4 py-2 text-center shadow-3xs">
            <span class="text-[9px] uppercase font-bold text-blue-800 tracking-wider block">{{ currentLang === 'km' ? 'តុមិនទាន់គិតលុយ' : 'Active unpaid tables' }}</span>
            <span class="text-sm sm:text-base font-black text-blue-700">{{ tableSessions.length }} {{ currentLang === 'km' ? 'តុ' : 'tables' }}</span>
          </div>

          <div class="bg-amber-50 border border-amber-200/60 rounded-xl px-3 sm:px-4 py-2 text-center shadow-3xs">
            <span class="text-[9px] uppercase font-bold text-amber-800 tracking-wider block">{{ currentLang === 'km' ? 'សំណើសុំទូទាត់ប្រាក់' : 'Unsettled Requests' }}</span>
            <span class="text-sm sm:text-base font-black text-amber-700 flex items-center justify-center gap-1">
              <span v-if="tableSessions.filter(s => s.isPending).length > 0" class="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
              {{ tableSessions.filter(s => s.isPending).length }} {{ currentLang === 'km' ? 'សំណើ' : 'requests' }}
            </span>
          </div>

          <button 
            @click="handleLogout" 
            class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-xl transition-all font-black text-xs flex items-center gap-1.5 outline-none cursor-pointer"
            title="Log Out/Shift Change"
          >
            <span class="material-symbols-outlined text-sm">logout</span>
            <span>{{ currentLang === 'km' ? 'ចាកចេញ' : 'Exit Drawer' }}</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Workspace -->
    <main class="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex-1 flex flex-col lg:flex-row gap-6">
      
      <!-- LEFT MODULE: Tables Sessions & Search Filters -->
      <section id="cashier-sessions" class="flex-1 lg:max-w-md w-full flex flex-col gap-4">
        <!-- QR STANDEE PRINT CENTER -->
        <div class="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md space-y-3.5 relative overflow-hidden">
          <div class="absolute -right-6 -bottom-6 w-24 h-24 bg-gradient-to-tr from-amber-500/20 to-transparent rounded-full pointer-events-none"></div>
          
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-amber-500 text-lg">qr_code_scanner</span>
            <h3 class="font-black text-xs uppercase tracking-wider text-amber-400">{{ currentLang === 'km' ? 'មជ្ឈមណ្ឌលផ្ទុកកូដ QR តុ' : 'QR Standee Print Center' }}</h3>
          </div>
          
          <p class="text-[11px] text-slate-300 leading-relaxed">
            {{ currentLang === 'km' ? 'ទាញយកខិត្តប័ណ្ណតុអាជីព កម្រិតច្បាស់ខ្ពស់។ បោះពុម្ព និងដាក់នៅលើតុអាហារ ដើម្បីឱ្យអតិថិជនអាចស្កេន កុម្ម៉ង់ និងទូទាត់ប្រាក់ជាភាសាខ្មែរ។' : 'Download professional, high-resolution table flyers. Print and present them on dining tables so customers can scan, order, and settle checks.' }}
          </p>
          
          <div class="pt-1.5 flex flex-col gap-2">
            <a 
              href="/gomeal_table_01_qr.pdf" 
              target="_blank" 
              class="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 py-2.5 px-4 rounded-xl font-bold text-center transition-all flex items-center justify-center gap-2 text-xs shadow-xs"
            >
              <span class="material-symbols-outlined text-sm">picture_as_pdf</span>
              {{ currentLang === 'km' ? 'ទាញយក QR សម្រាប់តុលេខ ០១ (PDF)' : 'Download Table 01 Standee (PDF)' }}
            </a>
          </div>
        </div>

        <!-- Search & Custom Filters -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="font-black text-sm uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-base">table_restaurant</span>
              {{ currentLang === 'km' ? 'បញ្ជីតុសកម្មគិតប្រាក់' : 'Dinner Dining Sessions' }}
            </h3>
            <span class="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {{ tableSessions.length }} {{ currentLang === 'km' ? 'តុសកម្ម' : 'live rows' }}
            </span>
          </div>

          <!-- Search Input -->
          <div class="relative">
            <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
            <input 
              v-model="searchQuery"
              type="text"
              :placeholder="currentLang === 'km' ? 'ស្វែងរកលេខតុ ឈ្មោះអតិថិជន...' : 'Search table, customer name...'"
              class="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-primary/20 text-xs font-semibold placeholder:text-slate-400 transition-all"
            />
          </div>

          <!-- Filter Segmented Tabs -->
          <div class="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
            <button 
              v-for="status in ['All', 'Unpaid', 'Pending'] as const"
              :key="status"
              @click="filterStatus = status"
              class="text-[10px] py-1.5 rounded-lg font-black transition-all"
              :class="filterStatus === status 
                ? 'bg-white text-primary shadow-3xs border border-slate-200/50' 
                : 'text-slate-500 hover:text-slate-800'"
            >
              {{ status === 'All' ? (currentLang === 'km' ? 'ទាំងអស់' : 'All') : status === 'Unpaid' ? (currentLang === 'km' ? 'មិនទាន់បង់' : 'Unpaid') : (currentLang === 'km' ? 'រង់ចាំទូទាត់' : 'Pending') }}
              <span v-if="status === 'Pending' && tableSessions.some(s => s.isPending)" class="inline-block w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce ml-0.5"></span>
            </button>
          </div>
        </div>

        <!-- Scrollable Active Sessions List -->
        <div class="bg-white rounded-3xl border border-slate-200 flex-1 min-h-[380px] overflow-hidden flex flex-col">
          <div class="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
            <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider">{{ currentLang === 'km' ? 'សូមជ្រើសរើសតុដើម្បីគិតប្រាក់' : 'Select a session to checkout' }}</span>
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" title="Connected to kitchen stream"></span>
          </div>

          <div class="p-4 overflow-y-auto space-y-2 flex-1 max-h-[500px] custom-scrollbar">
            <!-- Render Grid Cards of Tables -->
            <button 
              v-for="session in tableSessions"
              :key="session.tableNo"
              @click="selectedTable = session.tableNo"
              class="w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 outline-none active:scale-[0.99]"
              :class="[
                selectedTable === session.tableNo 
                  ? 'border-primary bg-primary/[0.03] shadow-md shadow-primary/5' 
                  : session.isPending 
                    ? 'border-amber-250 bg-amber-50/40 hover:bg-amber-50' 
                    : 'border-slate-200 bg-white hover:border-slate-300'
              ]"
            >
              <div class="flex items-center gap-3.5 min-w-0">
                <!-- Circular Table Label -->
                <div 
                  class="w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 shadow-3xs font-black"
                  :class="[
                    selectedTable === session.tableNo 
                      ? 'bg-primary text-white' 
                      : session.isPending 
                        ? 'bg-amber-500 text-white animate-pulse' 
                        : 'bg-slate-800 text-white'
                  ]"
                >
                  <span class="text-[8px] uppercase tracking-wide leading-none opacity-85">{{ currentLang === 'km' ? 'តុ' : 'TBL' }}</span>
                  <span class="text-sm leading-tight">{{ session.tableNo }}</span>
                </div>

                <!-- Session information -->
                <div class="min-w-0">
                  <h4 class="font-black text-xs text-slate-900 truncate flex items-center gap-1.5">
                    {{ session.name }}
                  </h4>
                  <p class="text-[10px] font-bold text-slate-400 mt-0.5 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[11px]">shopping_bag</span>
                    {{ session.items.reduce((sum, item) => sum + item.quantity, 0) }} {{ currentLang === 'km' ? 'មុខម្ហូបបានកុម្ម៉ង់' : 'item(s) ordered' }}
                  </p>
                </div>
              </div>

              <!-- Status Badge & Price Tag -->
              <div class="text-right shrink-0 flex flex-col items-end gap-1.5">
                <span class="text-[11px] font-black text-slate-900">${{ session.total.toFixed(2) }}</span>
                
                <!-- Explicit requested color (paid or unpay redshift indicator style) -->
                <span 
                  class="text-[9px] uppercase font-black px-2.5 py-1 rounded-full border shadow-3xs flex items-center gap-1"
                  :class="[
                    session.isPending 
                      ? 'bg-amber-100 text-amber-800 border-amber-250 animate-pulse' 
                      : 'bg-rose-100 text-rose-800 border-rose-250 font-black'
                  ]"
                >
                  <span class="w-1 h-1 rounded-full bg-current"></span>
                  {{ session.isPending ? (currentLang === 'km' ? 'រង់ចាំទូទាត់' : 'Pending Settle') : (currentLang === 'km' ? 'មិនទាន់បង់' : 'Unpaid') }}
                </span>
              </div>
            </button>

            <!-- Fallback Empty State -->
            <div v-if="tableSessions.length === 0" class="text-center py-20 px-6">
              <span class="material-symbols-outlined text-slate-300 text-5xl mb-3">check_circle</span>
              <p class="text-xs font-black text-slate-600">{{ currentLang === 'km' ? 'តុទាំងអស់ត្រូវបានគិតប្រាក់រួចរាល់!' : 'All tables are clean & paid!' }}</p>
              <p class="text-[10px] text-slate-400 font-semibold mt-1">{{ currentLang === 'km' ? 'សូមរង់ចាំរហូតដល់ភ្ញៀវកុម្ម៉ង់អាហារពីទំព័រអតិថិជន ដើម្បីបង្ហាញព័ត៌មាននៅក្នុងទំព័រនេះ។' : 'Wait for guests to order from the customer menu view to populate terminal sessions.' }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- RIGHT MODULE: Selected Settle Calculator -->
      <section id="cashier-calculator" class="flex-1 bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs flex flex-col min-h-[500px]">
        <div v-if="selectedSession" class="flex-1 flex flex-col gap-6">
          
          <!-- Header info -->
          <div class="border-b border-slate-100 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-black text-slate-900 uppercase">
                  {{ currentLang === 'km' ? 'តុលេខ #' + selectedSession.tableNo + ' ស្នើសុំទូទាត់' : 'Table #' + selectedSession.tableNo + ' Settle Request' }}
                </span>
                <span 
                  class="text-[9px] font-black uppercase px-2 py-0.5 rounded border"
                  :class="selectedSession.isPending ? 'bg-amber-50 text-amber-700 border-amber-250' : 'bg-rose-50 text-rose-600 border-rose-250'"
                >
                  {{ selectedSession.isPending ? (currentLang === 'km' ? 'រង់ចាំទូទាត់' : 'Pending') : (currentLang === 'km' ? 'មិនទាន់បង់' : 'Unpaid') }}
                </span>
              </div>
              <p class="text-xs text-slate-400 font-bold mt-1">
                {{ currentLang === 'km' ? 'គណនីអតិថិជន៖' : 'Customer Account:' }} <span class="text-primary font-black">{{ selectedSession.name }}</span>
              </p>
            </div>
            
            <button 
              @click="selectedTable = null"
              class="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-all"
              title="Close calculator panel"
            >
              <span class="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          <!-- Content split layout -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <!-- Sub-column 1: Itemized Bill Details -->
            <div class="space-y-4 flex flex-col">
              <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                {{ currentLang === 'km' ? 'បញ្ជីវិក្កយបត្រលម្អិត' : 'Detailed Invoice Checklist' }}
              </span>
              
              <div class="bg-slate-50 rounded-2xl border border-slate-150 p-4 space-y-3 flex-1 overflow-y-auto max-h-[250px] custom-scrollbar">
                <div v-for="item in selectedSession.items" :key="item.id" class="flex items-start justify-between text-xs py-1 border-b border-slate-200/55 last:border-0 font-bold">
                  <div class="min-w-0 flex-1 pr-3">
                    <p class="font-black text-slate-900 truncate">{{ translateDishName(item.name) }}</p>
                    <p class="text-[10px] text-primary font-black mt-0.5">${{ item.price.toFixed(2) }} × {{ item.quantity }}</p>
                    <p v-if="item.customizations !== 'Standard Portions'" class="text-[9px] text-slate-400 font-semibold italic truncate mt-0.5">
                      {{ item.customizations === 'Standard Portions' ? (currentLang === 'km' ? 'រូបមន្តស្តង់ដារ' : 'Standard Portions') : item.customizations }}
                    </p>
                  </div>
                  <span class="font-black text-slate-800 shrink-0 text-right">${{ (item.price * item.quantity).toFixed(2) }}</span>
                </div>
              </div>

              <!-- Price aggregates -->
              <div class="bg-slate-50 rounded-2xl p-4 border border-slate-150 space-y-2 mt-auto">
                <div class="flex justify-between items-center text-xs font-bold text-slate-400">
                  <span>{{ currentLang === 'km' ? 'តម្លៃសរុបដើម' : 'Subtotal sum' }}</span>
                  <span class="text-slate-700 font-black">${{ subtotalVal.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs font-bold text-slate-400">
                  <span>{{ currentLang === 'km' ? 'ពន្ធអាករ / VAT (10%)' : 'VAT / Tax (10%)' }}</span>
                  <span class="text-slate-700 font-black">${{ taxVal.toFixed(2) }}</span>
                </div>
                <div class="flex justify-between items-center text-xs font-bold text-slate-400">
                  <span>{{ currentLang === 'km' ? 'សេវាកម្ម (5%)' : 'Service Fee (5%)' }}</span>
                  <span class="text-slate-700 font-black">${{ serviceFeeVal.toFixed(2) }}</span>
                </div>
                <div class="pt-2 border-t border-slate-200 flex justify-between items-center">
                  <span class="text-xs font-black text-slate-900">{{ currentLang === 'km' ? 'តម្លៃសរុបចុងក្រោយ' : 'Final Grand Total' }}</span>
                  <span class="text-base font-black text-primary">${{ grandTotalVal.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Sub-column 2: Interactive payment method & registers calculator -->
            <div class="space-y-4 flex flex-col justify-between">
              <div>
                <span class="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1 mb-2">
                  {{ currentLang === 'km' ? 'ជ្រើសរើសវិធីសាស្ត្រទូទាត់' : 'Pick Payment Method' }}
                </span>
                <div class="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl">
                  <button 
                    v-for="method in ['Cash', 'Credit Card', 'Mobile Pay'] as const"
                    :key="method"
                    @click="selectedPaymentMethod = method"
                    class="py-2.5 rounded-xl font-black text-[10px] text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer outline-none"
                    :class="selectedPaymentMethod === method 
                      ? 'bg-primary text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'"
                  >
                    <span class="material-symbols-outlined text-base">
                      {{ method === 'Cash' ? 'payments' : method === 'Credit Card' ? 'credit_card' : 'contactless' }}
                    </span>
                    {{ method === 'Cash' ? (currentLang === 'km' ? 'លុយសុទ្ធ' : 'Cash') : method === 'Credit Card' ? (currentLang === 'km' ? 'កាតឥណទាន' : 'Credit Card') : (currentLang === 'km' ? 'ទូទាត់តាមទូរស័ព្ទ' : 'Mobile Pay') }}
                  </button>
                </div>
              </div>

              <!-- Dynamic Cash keypad and presets -->
              <div v-if="selectedPaymentMethod === 'Cash'" class="space-y-3.5 bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div class="flex justify-between items-center">
                  <span class="text-[9px] uppercase font-black text-slate-500">{{ currentLang === 'km' ? 'ការគណនាថតប្រាក់' : 'Cash Register Math' }}</span>
                  <button @click="clearCash" class="text-[9px] uppercase font-black text-rose-500 hover:underline outline-none">{{ currentLang === 'km' ? 'សម្អាតទិន្នន័យ' : 'Clear input' }}</button>
                </div>

                <!-- Input received cash -->
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">$</span>
                  <input 
                    v-model="amountPaid"
                    type="text"
                    :placeholder="currentLang === 'km' ? 'បញ្ចូលចំនួនទឹកប្រាក់ទទួលបាន...' : 'Enter cash received...'"
                    class="w-full bg-white border border-slate-300 rounded-xl pl-7 pr-3 py-2.5 outline-none font-bold text-xs focus:border-primary focus:ring-1 focus:ring-primary/10"
                  />
                </div>

                <!-- Cash Quick Presets Keys -->
                <div class="grid grid-cols-4 gap-1.5 font-bold">
                  <button @click="addPresetCash(0)" class="py-1.5 border border-slate-250 bg-white rounded-lg text-[10px] font-black hover:bg-slate-200 outline-none">{{ currentLang === 'km' ? 'គ្រប់ចំនួន' : 'Exact' }}</button>
                  <button @click="addPresetCash(10)" class="py-1.5 border border-slate-250 bg-white rounded-lg text-[10px] font-black hover:bg-slate-200 outline-none">+$10</button>
                  <button @click="addPresetCash(20)" class="py-1.5 border border-slate-250 bg-white rounded-lg text-[10px] font-black hover:bg-slate-200 outline-none">+$20</button>
                  <button @click="addPresetCash(50)" class="py-1.5 border border-slate-250 bg-white rounded-lg text-[10px] font-black hover:bg-slate-200 outline-none">+$50</button>
                </div>

                <!-- Real-time return change calculator indicator -->
                <div 
                  class="p-3.5 rounded-xl text-center shadow-3xs"
                  :class="cashReceivedNum >= grandTotalVal ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-rose-50 border border-rose-200 text-rose-800'"
                >
                  <div class="text-[9px] uppercase font-bold tracking-wider opacity-90 mb-1">
                    {{ cashReceivedNum >= grandTotalVal ? (currentLang === 'km' ? '📟 ប្រាក់អាប់ជូនភ្ញៀវ' : '📟 Return Change Due') : (currentLang === 'km' ? '⚠️ លុយខ្វះខាត' : '⚠️ Need more cash') }}
                  </div>
                  <div class="text-lg font-black">
                    ${{ changeDueNum.toFixed(2) }}
                  </div>
                </div>
              </div>

              <!-- Card/Mobile Info Notice -->
              <div v-else class="bg-blue-50/50 border border-blue-200 text-blue-900 rounded-2xl p-4 flex gap-3 items-start">
                <span class="material-symbols-outlined text-blue-700 shrink-0 mt-0.5">info</span>
                <div class="text-[11px] font-bold">
                  <p class="font-black">{{ currentLang === 'km' ? 'ការទូទាត់តាមអេឡិចត្រូនិកសកម្ម' : 'Electronic Settlement Active' }}</p>
                  <p class="text-blue-800/85 mt-1 leading-relaxed">
                    {{ currentLang === 'km' ? 'សូមប្រាកដថាអតិថិជនបានផ្ទៀងផ្ទាត់នៅលើម៉ាស៊ីនកាតរួចរាល់។ ការស្កេន ឬឆូតកាតនឹងអនុម័តដោយស្វ័យប្រវត្តិនូវចំនួនទឹកប្រាក់វិក្កយបត្រនេះ៖' : 'Ensure customer completes transaction on card terminal. Swipe/tap verification auto-authorizes this invoice amount of' }} <strong class="text-blue-950">${{ grandTotalVal.toFixed(2) }}</strong>.
                  </p>
                </div>
              </div>

              <!-- Bonus Tool: Split Bill Calculator -->
              <div class="border-t border-slate-150 pt-3">
                <p class="text-[9px] uppercase font-black text-slate-400 mb-1 bg-slate-50 px-2 py-1 rounded inline-block">{{ currentLang === 'km' ? 'ឧបករណ៍បែងចែកទឹកប្រាក់' : 'Split Invoice Tool' }}</p>
                <div class="grid grid-cols-4 gap-1 text-center text-[10px] font-bold text-slate-700 bg-slate-50 p-1.5 rounded-xl">
                  <div v-for="split in [2,3,4,5]" :key="split" class="border-r border-slate-200 last:border-r-0">
                    <span class="block text-[8px] uppercase tracking-wide opacity-55">×{{ split }} {{ currentLang === 'km' ? 'នាក់' : 'Guests' }}</span>
                    <strong class="text-primary font-bold block mt-0.5">${{ (grandTotalVal / split).toFixed(2) }}</strong>
                  </div>
                </div>
              </div>

              <!-- Primary checkout CTA button -->
              <button 
                @click="settleBill"
                class="w-full py-4 rounded-2xl font-black text-xs flex items-center justify-center gap-2 tracking-wider uppercase transition-all duration-200 shadow-md transform hover:-translate-y-px outline-none"
                :class="[
                  selectedPaymentMethod === 'Cash' && cashReceivedNum < grandTotalVal 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/10 active:scale-[0.98] cursor-pointer'
                ]"
              >
                <span class="material-symbols-outlined text-base">print</span>
                {{ currentLang === 'km' ? 'កត់ត្រាបានបង់ និងបោះពុម្ពវិក្កយបត្រ' : 'Mark Paid & print receipt' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Calculator default view -->
        <div v-else class="flex-grow flex flex-col items-center justify-center text-center py-24 px-6 text-slate-400">
          <div class="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400 shadow-3xs">
            <span class="material-symbols-outlined text-3xl">restaurant_menu</span>
          </div>
          <h3 class="text-sm font-black text-slate-900 uppercase">{{ currentLang === 'km' ? 'ប្រព័ន្ធគិតលុយអន្តរកម្ម' : 'Interactive Cashier Register' }}</h3>
          <p class="text-xs font-bold text-slate-400 mt-1 max-w-sm leading-relaxed">
            {{ currentLang === 'km' ? 'សូមជ្រើសរើសតុសកម្មណាមួយពីបញ្ជីខាងឆ្វេង ដើម្បីពិនិត្យមើលព័ត៌មានលម្អិតនៃវិក្កយបត្រ គណនាប្រាក់អាប់ ចែកការទូទាត់ និងបោះពុម្ពសំបុត្រទូទាត់ប្រាក់។' : 'Select any active dining table from the left list to review detailed invoice portions, compute change due, split bills, and print transaction tickets.' }}
          </p>
        </div>
      </section>
    </main>

    <!-- SECTION: BOTTOM TRANSACTION HISTORY REPORTS -->
    <section class="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 shrink-0">
      <div class="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <!-- Section Header -->
        <div class="px-6 py-5 border-b border-slate-100 bg-slate-50/75 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 class="font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-2">
              <span class="material-symbols-outlined text-emerald-600">done_all</span>
              {{ currentLang === 'km' ? 'របាយការណ៍ប្រវត្តិការទូទាត់ប្រចាំថ្ងៃ' : 'Daily Settlement History Reports' }}
            </h3>
            <p class="text-[10px] text-slate-400 font-semibold mt-0.5">
              {{ currentLang === 'km' ? 'កំណត់ត្រាសវនកម្មលម្អិតនៃតុដែលបានគិតប្រាក់រួចរាល់សម្រាប់វេនបច្ចុប្បន្ន' : 'Comprehensive audit log of checked-out sessions for current cashier shift' }}
            </p>
          </div>

          <div class="flex items-center gap-2.5">
            <span class="text-[10px] font-black bg-white px-3 py-1 border rounded-lg shadow-3xs text-slate-500">
              {{ currentLang === 'km' ? 'កាត៖' : 'Card:' }} ${{ methodBreakdown.Card.toFixed(2) }} | {{ currentLang === 'km' ? 'លុយសុទ្ធ៖' : 'Cash:' }} ${{ methodBreakdown.Cash.toFixed(2) }} | {{ currentLang === 'km' ? 'ចល័ត៖' : 'Mobile:' }} ${{ methodBreakdown.Mobile.toFixed(2) }}
            </span>
            <button 
              @click="clearAllTransactions"
              class="px-3 py-1.5 text-[10px] font-black border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg uppercase outline-none"
              title="Reset sales records"
            >
              {{ currentLang === 'km' ? 'សម្អាតកំណត់ត្រា' : 'Clear Records' }}
            </button>
          </div>
        </div>

        <!-- Transaction Table / Logs -->
        <div class="overflow-x-auto">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/50 border-b border-slate-200">
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'លេខកូដទូទាត់' : 'Transaction ID' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'ម៉ោងទូទាត់' : 'Timestamp' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'លេខតុ' : 'Table' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'ឈ្មោះអតិថិជន' : 'Guest Name' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'ចំនួនមុខម្ហូប' : 'Items Count' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'វិធីសាស្ត្រទូទាត់' : 'Payment type/method' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400">{{ currentLang === 'km' ? 'ប្រាក់ទូទាត់សរុប' : 'Grand Settle' }}</th>
                <th class="px-6 py-3.5 text-[10px] uppercase font-black tracking-wider text-slate-400 text-right">{{ currentLang === 'km' ? 'សកម្មភាពសវនកម្ម' : 'Audit actions' }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-bold text-xs text-slate-700 bg-white">
              <tr 
                v-for="tx in transactions"
                :key="tx.id"
                class="hover:bg-slate-50/40 transition-colors"
              >
                <!-- Transaction ID -->
                <td class="px-6 py-4 font-black text-primary">{{ tx.id }}</td>
                <!-- Timestamp -->
                <td class="px-6 py-4 text-slate-400 font-semibold">
                  {{ new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }}
                </td>
                <!-- Table -->
                <td class="px-6 py-4">
                  <span class="bg-slate-800 text-white px-2.5 py-0.5 rounded text-[10px] font-black">
                    {{ currentLang === 'km' ? 'តុ' : 'Table' }} {{ tx.tableNo }}
                  </span>
                </td>
                <!-- Guest Name -->
                <td class="px-6 py-4 text-slate-900 font-black">{{ tx.customerName }}</td>
                <!-- Items Count -->
                <td class="px-6 py-4 text-slate-500">
                  {{ tx.items.reduce((sum, i) => sum + i.quantity, 0) }} {{ currentLang === 'km' ? 'មុខម្ហូប' : 'item(s)' }}
                </td>
                <!-- Payment Method -->
                <td class="px-6 py-4">
                  <span 
                    class="text-[9px] uppercase font-black px-2 py-0.5 rounded-md border flex items-center gap-1 w-max"
                    :class="[
                      tx.paymentMethod === 'Cash' ? 'bg-amber-50 text-amber-800 border-amber-250' :
                      tx.paymentMethod === 'Credit Card' ? 'bg-blue-50 text-blue-800 border-blue-250' : 'bg-purple-50 text-purple-850 border-purple-200'
                    ]"
                  >
                    <span class="material-symbols-outlined text-[10px] font-black">
                      {{ tx.paymentMethod === 'Cash' ? 'payments' : tx.paymentMethod === 'Credit Card' ? 'credit_card' : 'contactless' }}
                    </span>
                    {{ tx.paymentMethod === 'Cash' ? (currentLang === 'km' ? 'លុយសុទ្ធ' : 'Cash') : tx.paymentMethod === 'Credit Card' ? (currentLang === 'km' ? 'កាតឥណទាន' : 'Credit Card') : (currentLang === 'km' ? 'ទូទាត់តាមទូរស័ព្ទ' : 'Mobile Pay') }}
                  </span>
                </td>
                <!-- Settle Amount -->
                <td class="px-6 py-4 text-slate-900 font-black">${{ tx.total.toFixed(2) }}</td>
                <!-- Actions -->
                <td class="px-6 py-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button 
                      @click="viewingReceipt = tx; showReceiptModal = true" 
                      class="px-2 py-1 text-[10px] font-black hover:bg-slate-100 text-slate-600 border border-slate-250 hover:border-slate-350 rounded transition-all flex items-center gap-1 outline-none"
                      title="View Receipt Summary"
                    >
                      <span class="material-symbols-outlined text-xs">receipt</span>
                      {{ currentLang === 'km' ? 'វិក្កយបត្រ' : 'Receipt' }}
                    </button>
                    <button 
                      @click="voidTx(tx)" 
                      class="px-2 py-1 text-[10px] font-black hover:bg-rose-50 text-rose-600 border border-transparent hover:border-rose-200 rounded transition-all flex items-center gap-1 outline-none"
                      title="Settle Void / Refund"
                    >
                      <span class="material-symbols-outlined text-xs">undo</span>
                      {{ currentLang === 'km' ? 'បោះបង់' : 'Void' }}
                    </button>
                  </div>
                </td>
              </tr>
              <tr v-if="transactions.length === 0">
                <td colspan="8" class="text-center py-10 text-slate-400 font-bold">
                  {{ currentLang === 'km' ? 'មិនទាន់មានកំណត់ត្រាប្រតិបត្តិការទូទាត់សម្រាប់វេននេះនៅឡើយទេ។ សូមកត់ត្រាតុដែលបានគិតប្រាក់ខាងលើ។' : 'No transactions logged for this shift yet. Mark active tables as paid above.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- FLOATING NO DATA TOAST -->
    <div 
      v-if="toastMessage"
      class="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white py-3.5 px-5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 font-bold text-xs animate-in slide-in-from-bottom duration-300 max-w-sm"
    >
      <span class="material-symbols-outlined text-emerald-400 font-black text-sm">notifications</span>
      <p class="text-slate-100 pr-4 leading-normal">{{ toastMessage }}</p>
      <button @click="toastMessage = null" class="text-slate-400 hover:text-white transition-colors shrink-0 font-bold ml-auto">
        <span class="material-symbols-outlined text-xs">close</span>
      </button>
    </div>

    <!-- DIGITAL RECEIPT PRINT MODAL -->
    <div 
      v-if="showReceiptModal && viewingReceipt"
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all duration-200"
    >
      <div 
        class="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 p-6 flex flex-col gap-6 font-bold"
      >
        <!-- Receipt title -->
        <div class="text-center space-y-1">
          <p class="text-xs uppercase font-black tracking-widest text-primary italic">TosEat. OS</p>
          <h3 class="text-2xl font-black text-slate-900 font-display">{{ currentLang === 'km' ? 'វិក្កយបត្រទូទាត់ប្រាក់' : 'PAYMENT RECEIPT' }}</h3>
          <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{{ currentLang === 'km' ? 'ម៉ាស៊ីនគិតគំរូ៖ #POS-01' : 'Shift Register: #POS-01' }}</p>
        </div>

        <!-- Receipt pattern dotted divider line -->
        <div class="border-t-2 border-dashed border-slate-200 py-1"></div>

        <!-- Meta list -->
        <div class="space-y-2 text-xs font-semibold text-slate-600">
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'លេខកូដវិក្កយបត្រ៖' : 'Invoice ID:' }}</span>
            <span class="font-black text-slate-950">{{ viewingReceipt.id }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'កាលបរិច្ឆេទ៖' : 'Date Placed:' }}</span>
            <span class="text-slate-950">{{ new Date(viewingReceipt.timestamp).toLocaleDateString() }} - {{ new Date(viewingReceipt.timestamp).toLocaleTimeString() }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'វិធីសាស្ត្រទូទាត់៖' : 'Settle Method:' }}</span>
            <span class="font-black text-slate-950 uppercase">
              {{ viewingReceipt.paymentMethod === 'Cash' ? (currentLang === 'km' ? 'លុយសុទ្ធ' : 'Cash') : viewingReceipt.paymentMethod === 'Credit Card' ? (currentLang === 'km' ? 'កាតឥណទាន' : 'Credit Card') : (currentLang === 'km' ? 'ទូទាត់តាមទូរស័ព្ទ' : 'Mobile Pay') }}
            </span>
          </div>
          <div class="flex justify-between pb-2 border-b border-slate-100">
            <span>{{ currentLang === 'km' ? 'លេខកៅអី/តុ៖' : 'Customer Desk:' }}</span>
            <span class="font-black text-primary">{{ currentLang === 'km' ? 'តុ' : 'Table' }} {{ viewingReceipt.tableNo }} ({{ viewingReceipt.customerName }})</span>
          </div>
        </div>

        <!-- Items Breakdown inside receipt -->
        <div class="space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar">
          <div v-for="item in viewingReceipt.items" :key="item.name" class="flex justify-between text-xs text-slate-800">
            <span class="truncate font-semibold">{{ translateDishName(item.name) }} <em class="text-slate-400 font-bold not-italic">×{{ item.quantity }}</em></span>
            <span class="font-black text-slate-900">${{ (item.price * item.quantity).toFixed(2) }}</span>
          </div>
        </div>

        <!-- Billing details block -->
        <div class="border-t border-slate-200 pt-3 space-y-1.5 text-xs font-semibold text-slate-600">
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'តម្លៃសរុបដើម៖' : 'Subtotal :' }}</span>
            <span class="text-slate-950">${{ viewingReceipt.subtotal.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'ពន្ធអាករ (10%)៖' : 'VA Tax (10%) :' }}</span>
            <span class="text-slate-950">${{ viewingReceipt.tax.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between">
            <span>{{ currentLang === 'km' ? 'សេវាកម្ម (5%)៖' : 'Service Fee (5%) :' }}</span>
            <span class="text-slate-950">${{ viewingReceipt.serviceFee.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between text-sm pt-2 border-t-2 border-dashed border-slate-200">
            <span class="font-black text-slate-950">{{ currentLang === 'km' ? 'ចំនួនសរុបត្រូវបង់៖' : 'Grand Settle Amount:' }}</span>
            <span class="font-black text-primary font-display">${{ viewingReceipt.total.toFixed(2) }}</span>
          </div>

          <!-- Cash change statistics if any -->
          <div v-if="viewingReceipt.paymentMethod === 'Cash'" class="bg-slate-50 p-2.5 rounded-xl space-y-1 mt-2 border border-slate-150">
            <div class="flex justify-between text-[11px]">
              <span>{{ currentLang === 'km' ? 'ប្រាក់ទទួលបាន៖' : 'Cash Tributed:' }}</span>
              <span class="font-black text-slate-900">${{ (viewingReceipt.cashReceived || 0).toFixed(2) }}</span>
            </div>
            <div class="flex justify-between text-[11px] text-emerald-800">
              <span class="font-black">{{ currentLang === 'km' ? 'ប្រាក់អាប់ជូនវិញ៖' : 'Change Settle Returned:' }}</span>
              <span class="font-bold font-mono">${{ (viewingReceipt.changeDue || 0).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <div class="border-t-2 border-dashed border-slate-200 py-1"></div>

        <!-- Sticky Footer Notes -->
        <div class="text-center space-y-1.5 shrink-0">
          <p class="text-xs font-black text-slate-900 uppercase">
            {{ currentLang === 'km' ? 'សូមអរគុណសម្រាប់ការពិសាអាហារនៅ TosEat!' : 'Thank You for Dining with TosEat!' }}
          </p>
          <p class="text-[10px] text-slate-400 font-bold leading-normal">
            {{ currentLang === 'km' ? 'ការគាំទ្ររបស់លោកអ្នកនាំមកនូវអត្ថន័យដ៏ល្អសម្រាប់ពួកយើង។ សូមមានថ្ងៃដ៏អស្ចារ្យ!' : 'Your patronage makes our culinary art meaningful. Have an exceptional day!' }}
          </p>
        </div>

        <!-- Print Action CTA and Close -->
        <div class="grid grid-cols-2 gap-3 shrink-0">
          <button 
            @click="showReceiptModal = false" 
            class="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-black text-xs uppercase outline-none"
          >
            {{ currentLang === 'km' ? 'បិទចោល' : 'Settle Close' }}
          </button>
          <button 
            @click="showToast(currentLang === 'km' ? '🖨️ កំពុងសាកល្បងបោះពុម្ពវិក្កយបត្រ។ ជោគជ័យ!' : '🖨️ Simulating direct register print. Success!')" 
            class="py-3 bg-primary text-white rounded-xl hover:opacity-95 active:scale-95 transition-all font-black text-xs uppercase flex items-center justify-center gap-1.5 outline-none"
          >
            <span class="material-symbols-outlined text-sm font-bold">print</span>
            {{ currentLang === 'km' ? 'បោះពុម្ព' : 'Print Receipt' }}
          </button>
        </div>
      </div>
    </div>

    <!-- CUSTOM CONFIRMATION ACTION DIALOG -->
    <div 
      v-if="isConfirmOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-xs z-[100] flex items-center justify-center p-4 transition-all duration-300"
    >
      <div 
        class="bg-white rounded-[28px] max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col gap-5 font-bold"
      >
        <div class="flex items-center gap-3.5 bg-rose-50 border border-rose-100 p-4 rounded-2xl">
          <div class="w-10 h-10 rounded-full bg-rose-500 flex items-center justify-center shrink-0 text-white">
            <span class="material-symbols-outlined text-xl">warning</span>
          </div>
          <div>
            <h4 class="font-black text-sm text-rose-950 uppercase tracking-wide">{{ confirmTitle }}</h4>
            <p class="text-[10px] text-rose-800 font-bold mt-0.5">
              {{ currentLang === 'km' ? 'សូមបញ្ជាក់ការសម្រេចចិត្តរបស់អ្នកខាងក្រោម' : 'Please confirm your decision below' }}
            </p>
          </div>
        </div>

        <p class="text-xs text-slate-600 font-semibold leading-relaxed px-1">
          {{ confirmMessage }}
        </p>

        <div class="grid grid-cols-2 gap-3 mt-1.5 shrink-0">
          <button 
            @click="isConfirmOpen = false" 
            class="py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all font-black text-xs uppercase outline-none"
          >
            {{ currentLang === 'km' ? 'បោះបង់' : 'Cancel' }}
          </button>
          <button 
            @click="execConfirmYes" 
            class="py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl active:scale-95 transition-all font-black text-xs uppercase shadow-sm shadow-rose-600/10 outline-none"
          >
            {{ currentLang === 'km' ? 'យល់ព្រម' : 'Yes, Confirm' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 9px;
}
</style>
