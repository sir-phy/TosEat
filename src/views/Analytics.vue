<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import * as d3 from 'd3'
import { t, currentLang, setLang, translateDishName } from '../i18n'

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

interface OrderItem {
  id: number
  name: string
  price: number
  quantity: number
  status: string
  customizations: string
  tableNo: string
  customerName?: string
  paymentStatus?: 'Unpaid' | 'Pending' | 'Paid'
  timePlaced?: string
}

// State inputs loaded from localStorage pools
const activeOrders = ref<OrderItem[]>([])
const payoutHistory = ref<SettleTransaction[]>([])
const ticketHistory = ref<any[]>([])

const selectedTimeframe = ref<'Day' | 'Week' | 'Month'>('Week')
const selectedMetric = ref<'sales' | 'covers'>('sales')
const hoveredChartPoint = ref<{ val: number; label: string; x: number; y: number } | null>(null)
const toastMessage = ref<string | null>(null)

const showToast = (msg: string) => {
  toastMessage.value = msg
  setTimeout(() => {
    if (toastMessage.value === msg) {
      toastMessage.value = null
    }
  }, 4500)
}

// Core aggregations
const revenueSum = computed(() => {
  return payoutHistory.value.reduce((sum, tx) => sum + tx.total, 0)
})

const totalCovers = computed(() => {
  return payoutHistory.value.reduce((sum, tx) => {
    return sum + tx.items.reduce((acc, item) => acc + item.quantity, 0)
  }, 0)
})

const outstandingReceivables = computed(() => {
  return activeOrders.value.reduce((sum, order) => {
    return sum + (order.price * order.quantity)
  }, 0)
})

const unpaidTablesCount = computed(() => {
  const uniqTables = new Set(activeOrders.value.map(o => o.tableNo))
  return uniqTables.size
})

const averageTicketSum = computed(() => {
  if (payoutHistory.value.length === 0) return 0
  return +(revenueSum.value / payoutHistory.value.length).toFixed(2)
})

// Grouped Sales over time for charts
const salesHistoryChartData = computed(() => {
  // If we have no payout history, return seeded empty structure
  if (payoutHistory.value.length === 0) {
    return [
      { label: 'Mon', value: 0 },
      { label: 'Tue', value: 0 },
      { label: 'Wed', value: 0 },
      { label: 'Thu', value: 0 },
      { label: 'Fri', value: 0 },
      { label: 'Sat', value: 0 },
      { label: 'Sun', value: 0 }
    ]
  }

  // Sort transaction records ascendingly
  const sorted = [...payoutHistory.value].sort((a, b) => a.timestamp - b.timestamp)

  if (selectedTimeframe.value === 'Day') {
    // Group records by Hour of current day
    const hours = Array.from({ length: 12 }, (_, i) => {
      const h = (i * 2) + 2
      const ampm = h >= 12 ? 'PM' : 'AM'
      const displayHour = h > 12 ? h - 12 : h
      return { 
        h, 
        label: `${displayHour} ${ampm}`, 
        value: 0, 
        coversVal: 0 
      }
    })

    sorted.forEach(tx => {
      const date = new Date(tx.timestamp)
      const hour = date.getHours()
      
      // Map to closest 2-hour interval
      const intervalIndex = Math.min(Math.floor(hour / 2), 11)
      if (hours[intervalIndex]) {
        hours[intervalIndex].value += tx.total
        hours[intervalIndex].coversVal += tx.items.reduce((acc, item) => acc + item.quantity, 0)
      }
    })

    return hours.map(h => ({
      label: h.label,
      value: selectedMetric.value === 'sales' ? +h.value.toFixed(2) : h.coversVal
    }))
  }

  if (selectedTimeframe.value === 'Week') {
    // Group records by day of the week
    const days = [
      { key: 1, label: currentLang.value === 'km' ? 'ចន្ទ' : 'Mon', value: 0, coversVal: 0 },
      { key: 2, label: currentLang.value === 'km' ? 'អង្គារ' : 'Tue', value: 0, coversVal: 0 },
      { key: 3, label: currentLang.value === 'km' ? 'ពុធ' : 'Wed', value: 0, coversVal: 0 },
      { key: 4, label: currentLang.value === 'km' ? 'ព្រហ' : 'Thu', value: 0, coversVal: 0 },
      { key: 5, label: currentLang.value === 'km' ? 'សុក្រ' : 'Fri', value: 0, coversVal: 0 },
      { key: 6, label: currentLang.value === 'km' ? 'សៅរ៍' : 'Sat', value: 0, coversVal: 0 },
      { key: 0, label: currentLang.value === 'km' ? 'អាទិត្យ' : 'Sun', value: 0, coversVal: 0 }
    ]

    sorted.forEach(tx => {
      const date = new Date(tx.timestamp)
      const dayOfWeek = date.getDay()
      const d = days.find(day => day.key === dayOfWeek)
      if (d) {
        d.value += tx.total
        d.coversVal += tx.items.reduce((acc, item) => acc + item.quantity, 0)
      }
    })

    // Rotate array to start on Monday
    const mon = days.shift()
    if (mon) days.push(mon)

    return days.map(d => ({
      label: d.label,
      value: selectedMetric.value === 'sales' ? +d.value.toFixed(2) : d.coversVal
    }))
  }

  // Monthly breakdown: Group by week cycles
  const weeks = [
    { label: currentLang.value === 'km' ? 'សប្តាហ៍ទី ១' : 'Week 1', value: 0, coversVal: 0 },
    { label: currentLang.value === 'km' ? 'សប្តាហ៍ទី ២' : 'Week 2', value: 0, coversVal: 0 },
    { label: currentLang.value === 'km' ? 'សប្តាហ៍ទី ៣' : 'Week 3', value: 0, coversVal: 0 },
    { label: currentLang.value === 'km' ? 'សប្តាហ៍ទី ៤' : 'Week 4', value: 0, coversVal: 0 }
  ]

  sorted.forEach(tx => {
    const date = new Date(tx.timestamp)
    const day = date.getDate()
    
    let index = 0
    if (day > 7 && day <= 14) index = 1
    else if (day > 14 && day <= 21) index = 2
    else if (day > 21) index = 3

    weeks[index].value += tx.total
    weeks[index].coversVal += tx.items.reduce((acc, item) => acc + item.quantity, 0)
  })

  return weeks.map(w => ({
    label: w.label,
    value: selectedMetric.value === 'sales' ? +w.value.toFixed(2) : w.coversVal
  }))
})

// Category Breakdown Calculations for analytics
const popularDishRanking = computed(() => {
  const dictionary: { [key: string]: { name: string; totalSales: number; count: number; category: string } } = {}

  // Aggregate quantity and amounts
  payoutHistory.value.forEach(tx => {
    tx.items.forEach(item => {
      const name = item.name
      // Categorize basic items
      let category = 'Others'
      if (name.includes('Burger')) category = 'Burger'
      else if (name.includes('Pizza')) category = 'Pizza'
      else if (name.includes('Fries') || name.includes('Sandwich')) category = 'Snack'
      else if (name.includes('Cola') || name.includes('Smoothie') || name.includes('Coffee')) category = 'Beverage'
      else if (name.includes('Ramen') || name.includes('Sushi')) category = 'Entrée'

      if (!dictionary[name]) {
        dictionary[name] = { name: name, totalSales: 0, count: 0, category: category }
      }
      dictionary[name].count += item.quantity
      dictionary[name].totalSales += item.price * item.quantity
    })
  });

  const list = Object.values(dictionary)
  return list.sort((a, b) => b.totalSales - a.totalSales)
})

// Dynamic Table Efficiency rating
const tableYields = computed(() => {
  const tablesDictionary: { [key: string]: { tableNo: string; count: number; totalRevenue: number } } = {}

  // Populate tables
  payoutHistory.value.forEach(tx => {
    const number = tx.tableNo || '12B'
    if (!tablesDictionary[number]) {
      tablesDictionary[number] = { tableNo: number, count: 0, totalRevenue: 0 }
    }
    tablesDictionary[number].count++
    tablesDictionary[number].totalRevenue += tx.total
  })

  // Add outstanding active table data
  activeOrders.value.forEach(o => {
    const number = o.tableNo || '12B'
    if (!tablesDictionary[number]) {
      tablesDictionary[number] = { tableNo: number, count: 0, totalRevenue: 0 }
    }
    // Aggregate outstanding potential 
    tablesDictionary[number].totalRevenue += (o.price * o.quantity)
  })

  return Object.values(tablesDictionary).sort((a, b) => b.totalRevenue - a.totalRevenue)
})

// Peak Dining Hours Index Histogram
const peakHourlySegments = computed(() => {
  const intervals = [
    { span: '08:00 AM - 11:30 AM', segment: 'Breakfast Rush', density: 0, count: 0 },
    { span: '11:45 AM - 02:30 PM', segment: 'Lunch Rush', density: 0, count: 0 },
    { span: '02:45 PM - 05:30 PM', segment: 'Afternoon Quiet', density: 0, count: 0 },
    { span: '05:45 PM - 09:30 PM', segment: 'Dinner Peak', density: 0, count: 0 }
  ]

  payoutHistory.value.forEach(tx => {
    const hour = new Date(tx.timestamp).getHours()
    
    if (hour >= 8 && hour < 12) {
      intervals[0].count += tx.items.reduce((acc, i) => acc + i.quantity, 0)
    } else if (hour >= 12 && hour < 15) {
      intervals[1].count += tx.items.reduce((acc, i) => acc + i.quantity, 0)
    } else if (hour >= 15 && hour < 18) {
      intervals[2].count += tx.items.reduce((acc, i) => acc + i.quantity, 0)
    } else {
      intervals[3].count += tx.items.reduce((acc, i) => acc + i.quantity, 0)
    }
  })

  const maxCount = Math.max(...intervals.map(i => i.count), 1)
  intervals.forEach(i => {
    i.density = Math.round((i.count / maxCount) * 100)
  })

  return intervals
})

// Kitchen preparation status log aggregates
const kitchenStatusAggregation = computed(() => {
  const pendingOrders = activeOrders.value.filter(o => o.status !== 'Served')
  const completedHistoryCount = ticketHistory.value.length

  return {
    pendingInKitchen: pendingOrders.length,
    completedTickets: completedHistoryCount,
    readyToServe: activeOrders.value.filter(o => o.status === 'Ready to Serve').length
  }
})

// Dynamic SVG Path generation using pure SVG coordinates mapped via d3 scaling
const d3ChartSvgPath = computed(() => {
  const data = salesHistoryChartData.value
  const width = 500
  const height = 150
  if (data.length === 0) {
    return {
      linePath: '',
      areaPath: '',
      points: [],
      height: height,
      width: width,
      ticksY: [0, 25, 50]
    }
  }
  const paddingX = 40
  const paddingY = 20

  const values = data.map(d => d.value)
  const maxValue = Math.max(...values, 50)

  // Scale Functions
  const scaleX = d3.scaleLinear()
    .domain([0, data.length - 1])
    .range([paddingX, width - paddingX])

  const scaleY = d3.scaleLinear()
    .domain([0, maxValue])
    .range([height - paddingY, paddingY])

  // Build points line
  const points = data.map((d, index) => {
    const cx = scaleX(index)
    const cy = scaleY(d.value)
    return { x: cx, y: cy, label: d.label, val: d.value }
  })

  // Format line path d-string
  let pathD = ''
  points.forEach((pt, idx) => {
    if (idx === 0) {
      pathD += `M ${pt.x} ${pt.y}`
    } else {
      // Draw smooth curve using cubic bezier control points
      const prev = points[idx - 1]
      const cpX1 = prev.x + (pt.x - prev.x) / 2
      const cpY1 = prev.y
      const cpX2 = prev.x + (pt.x - prev.x) / 2
      const cpY2 = pt.y
      pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${pt.x} ${pt.y}`
    }
  })

  // Area path shaded overlay
  let areaD = ''
  if (points.length > 0) {
    areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
  }

  return {
    linePath: pathD,
    areaPath: areaD,
    points: points,
    height: height,
    width: width,
    ticksY: [0, Math.round(maxValue / 2), Math.round(maxValue)]
  }
})

const triggerHoverPoint = (pt: any) => {
  hoveredChartPoint.value = pt
}

const clearHoverPoint = () => {
  hoveredChartPoint.value = null
}

// Sandbox simulator dataset infuser
const injectSimulationTransactions = () => {
  const current = Date.now()
  const daysInMs = 24 * 3600 * 1000

  const seededTransactions: SettleTransaction[] = [
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 0.1), // Today Afternoon
      tableNo: '04',
      customerName: 'Elena Rostova',
      items: [
        { name: 'Pepperoni Pizza', price: 18.99, quantity: 2 },
        { name: 'Coca Cola', price: 2.50, quantity: 4 }
      ],
      subtotal: 47.98,
      tax: 4.80,
      serviceFee: 2.40,
      total: 55.18,
      paymentMethod: 'Credit Card'
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 0.4), // Today morning
      tableNo: '02',
      customerName: 'Aria Montgomery',
      items: [
        { name: 'Cheese Burger', price: 12.50, quantity: 3 },
        { name: 'French Fries', price: 5.50, quantity: 3 },
        { name: 'Berry Smoothie', price: 7.50, quantity: 1 }
      ],
      subtotal: 61.50,
      tax: 6.15,
      serviceFee: 3.08,
      total: 70.73,
      paymentMethod: 'Cash',
      cashReceived: 80.00,
      changeDue: 9.27
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 1.2), // Yesterday
      tableNo: '12B',
      customerName: 'Sophy Moeurn',
      items: [
        { name: 'Club Sandwich', price: 9.80, quantity: 2 },
        { name: 'Berry Smoothie', price: 7.50, quantity: 2 }
      ],
      subtotal: 34.60,
      tax: 3.46,
      serviceFee: 1.73,
      total: 39.79,
      paymentMethod: 'Mobile Pay'
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 2.1), // 2 days ago
      tableNo: '08',
      customerName: 'Marcus Aurelius',
      items: [
        { name: 'Pepperoni Pizza', price: 18.99, quantity: 1 },
        { name: 'Club Sandwich', price: 9.80, quantity: 1 }
      ],
      subtotal: 28.79,
      tax: 2.88,
      serviceFee: 1.44,
      total: 33.11,
      paymentMethod: 'Credit Card'
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 3.5), // 3 days ago
      tableNo: '01',
      customerName: 'Captain Daniel',
      items: [
        { name: 'Cheese Burger', price: 12.50, quantity: 2 },
        { name: 'Pepperoni Pizza', price: 18.99, quantity: 1 },
        { name: 'Coca Cola', price: 2.50, quantity: 3 }
      ],
      subtotal: 51.49,
      tax: 5.15,
      serviceFee: 2.57,
      total: 59.21,
      paymentMethod: 'Credit Card'
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 4.9), // 4 days ago
      tableNo: '04',
      customerName: 'Gale Hawthorne',
      items: [
        { name: 'Japanese Ramen', price: 15.00, quantity: 4 },
        { name: 'Berry Smoothie', price: 7.50, quantity: 2 }
      ],
      subtotal: 75.00,
      tax: 7.50,
      serviceFee: 3.75,
      total: 86.25,
      paymentMethod: 'Mobile Pay'
    },
    {
      id: `TXN-${Math.floor(10000 + Math.random() * 90000)}`,
      timestamp: current - (daysInMs * 5.8), // 5 days ago
      tableNo: '02',
      customerName: 'Katniss Everdeen',
      items: [
        { name: 'Cheese Burger', price: 12.50, quantity: 1 },
        { name: 'French Fries', price: 5.50, quantity: 2 }
      ],
      subtotal: 23.50,
      tax: 2.35,
      serviceFee: 1.18,
      total: 27.03,
      paymentMethod: 'Cash',
      cashReceived: 30.00,
      changeDue: 2.97
    }
  ]

  // Mix standard active and completed tickets
  const sampleChefHistory = [
    { id: 10022, name: 'Cheese Burger', price: 12.5, quantity: 2, servedAt: current - 180000, tableNo: '04' },
    { id: 10023, name: 'French Fries', price: 5.5, quantity: 1, servedAt: current - 120000, tableNo: '04' },
    { id: 10024, name: 'Pepperoni Pizza', price: 18.99, quantity: 1, servedAt: current - 60000, tableNo: '12B' }
  ]

  // Persist
  payoutHistory.value = seededTransactions
  localStorage.setItem('gomeal_payout_history', JSON.stringify(seededTransactions))

  ticketHistory.value = sampleChefHistory
  localStorage.setItem('gomeal_ticket_history', JSON.stringify(sampleChefHistory))

  showToast('📈 Simulation analytics populated! Fully customized chart curves and lists render successfully.')
  window.dispatchEvent(new Event('storage'))
}

const clearAllPortalData = () => {
  if (confirm('Are you sure you want to restore analytics demo registry? This clears current local variables.')) {
    payoutHistory.value = []
    localStorage.removeItem('gomeal_payout_history')
    ticketHistory.value = []
    localStorage.removeItem('gomeal_ticket_history')
    showToast('♻️ Analytics history reset to default configuration.')
    window.dispatchEvent(new Event('storage'))
  }
}

const loadData = () => {
  // Load payments History
  const payoutStored = localStorage.getItem('gomeal_payout_history')
  if (payoutStored) {
    try {
      payoutHistory.value = JSON.parse(payoutStored)
    } catch (e) {
      console.error(e)
    }
  }

  // Load Active orders
  const activeStored = localStorage.getItem('gomeal_customer_orders')
  if (activeStored) {
    try {
      activeOrders.value = JSON.parse(activeStored)
    } catch (e) {
      console.error(e)
    }
  }

  // Load completed Chef history
  const chefStored = localStorage.getItem('gomeal_ticket_history')
  if (chefStored) {
    try {
      ticketHistory.value = JSON.parse(chefStored)
    } catch (e) {
      console.error(e)
    }
  }
}

watch(currentLang, () => {
  loadData()
})

let syncInterval: any = null

onMounted(() => {
  loadData()
  window.addEventListener('storage', loadData)
  
  // Auto-refresh stats
  syncInterval = setInterval(loadData, 2500)
})

onUnmounted(() => {
  window.removeEventListener('storage', loadData)
  if (syncInterval) clearInterval(syncInterval)
})
</script>

<template>
  <div class="min-h-screen bg-slate-50/50 p-6 lg:p-8 space-y-6">
    <!-- Owner Header Section -->
    <header class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200/60 pb-5">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-[10px] uppercase font-black text-primary tracking-widest bg-primary/10 px-2.5 py-1 rounded-lg">
            {{ currentLang === 'km' ? 'សវនកម្មពេលវេលាជាក់ស្តែង' : 'Realtime Audit' }}
          </span>
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <h2 class="text-2xl font-black text-slate-900 tracking-tight">
          {{ currentLang === 'km' ? 'ផ្ទាំងវិភាគទិន្នន័យអាជីវកម្ម' : 'Business Analytics Dashboard' }}
        </h2>
        <p class="text-xs text-slate-400 font-semibold leading-normal">
          {{ currentLang === 'km' ? 'វាយតម្លៃល្បឿនចំណូលភោជនីយដ្ឋាន និន្នាការមុខម្ហូបល្បីៗ ម៉ោងមមាញឹក និងសន្ទស្សន៍លទ្ធផលតុនីមួយៗ។' : 'Evaluate restaurant revenue velocities, popular menu trends, clock-cycle peaks, and table performance indexes.' }}
        </p>
      </div>

      <!-- Simulator & Reset triggers -->
      <div id="analytics-global-controls" class="flex flex-wrap items-center gap-2.5">
        <!-- Language Switcher segmented toggle -->
        <div class="flex items-center gap-0.5 bg-slate-100 border border-slate-200 shadow-xs rounded-xl p-0.5 transition-all mr-1.5">
          <button 
            @click="setLang('en')" 
            class="px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all outline-none"
            :class="currentLang === 'en' ? 'bg-white text-primary shadow-2xs' : 'text-slate-600 hover:text-slate-800'"
          >
            EN
          </button>
          <button 
            @click="setLang('km')" 
            class="px-2.5 py-1.5 text-[10px] font-black rounded-lg transition-all outline-none"
            :class="currentLang === 'km' ? 'bg-white text-primary shadow-2xs' : 'text-slate-600 hover:text-slate-800'"
          >
            ខ្មែរ
          </button>
        </div>

        <button 
          @click="injectSimulationTransactions"
          class="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-wide transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer outline-none"
        >
          <span class="material-symbols-outlined text-sm font-bold">query_stats</span>
          {{ currentLang === 'km' ? 'បញ្ចូលទិន្នន័យគំរូ' : 'Infuse Sim Dataset' }}
        </button>

        <button 
          @click="clearAllPortalData"
          class="px-4 py-2.5 bg-white border border-slate-250 hover:bg-slate-50 text-slate-600 rounded-xl font-black text-xs uppercase tracking-wide transition-all active:scale-95 cursor-pointer outline-none"
        >
          {{ currentLang === 'km' ? 'សម្អាតកំណត់ត្រា' : 'Reset Logs' }}
        </button>
      </div>
    </header>

    <!-- KEY PERFORMANCE INDICATORS GRID -->
    <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- Card index 1: Total Gross Revenue -->
      <article id="stat-revenue" class="bg-white border border-slate-250/70 p-5 rounded-3xl shadow-3xs flex justify-between items-center relative overflow-hidden transition-all hover:scale-[1.01]">
        <div class="space-y-1.5 z-10 w-full">
          <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">{{ currentLang === 'km' ? 'ចំណូលលក់ដាច់សុទ្ធ' : 'Net Account Sales' }}</span>
          <h3 class="text-2xl font-black text-slate-900 font-display">${{ revenueSum.toFixed(2) }}</h3>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>{{ currentLang === 'km' ? 'វិក្កយបត្ររួចរាល់៖' : 'Settle Tickets:' }} <strong>{{ payoutHistory.length }} {{ currentLang === 'km' ? 'ប្រតិបត្តិការ' : 'completed' }}</strong></span>
            <span class="text-emerald-600 font-semibold flex items-center gap-0.5">
              <span class="material-symbols-outlined text-xs leading-none">trending_up</span>
              +14.8%
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-xl">payments</span>
        </div>
      </article>

      <!-- Card index 2: Average Ticket Size -->
      <article id="stat-avg-ticket" class="bg-white border border-slate-250/70 p-5 rounded-3xl shadow-3xs flex justify-between items-center relative overflow-hidden transition-all hover:scale-[1.01]">
        <div class="space-y-1.5 z-10 w-full">
          <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">{{ currentLang === 'km' ? 'មធ្យមភាគក្នុងមួយវិក្កយបត្រ' : 'Avg. Ticket Yield' }}</span>
          <h3 class="text-2xl font-black text-slate-900 font-display">${{ averageTicketSum.toFixed(2) }}</h3>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>{{ currentLang === 'km' ? 'កម្រងទូទាត់មធ្យមរបស់ភ្ញៀវ' : 'Average per guest check' }}</span>
            <span class="text-slate-500 font-semibold">{{ currentLang === 'km' ? 'ទូទាត់ថេរ' : 'Constant Settle' }}</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-primary-fixed/30 text-primary flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-xl">receipt_long</span>
        </div>
      </article>

      <!-- Card index 3: Pending Receivables -->
      <article id="stat-pending" class="bg-white border border-slate-250/70 p-5 rounded-3xl shadow-3xs flex justify-between items-center relative overflow-hidden transition-all hover:scale-[1.01]">
        <div class="space-y-1.5 z-10 w-full">
          <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">{{ currentLang === 'km' ? 'មិនទាន់ទូទាត់សរុប' : 'Unpaid Outstanding' }}</span>
          <h3 class="text-2xl font-black text-slate-900 font-display">${{ outstandingReceivables.toFixed(2) }}</h3>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>{{ currentLang === 'km' ? 'តុគ្មានការទូទាត់៖' : 'Occupied Desks:' }} <strong>{{ unpaidTablesCount }} {{ currentLang === 'km' ? 'តុ' : 'tables' }}</strong></span>
            <span class="text-rose-600 font-black flex items-center gap-0.5 animate-pulse">
              <span class="w-1.5 h-1.5 bg-rose-500 rounded-full"></span>
              {{ currentLang === 'km' ? 'រង់ចាំសម្អាត' : 'Awaiting Clear' }}
            </span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-xl">timer</span>
        </div>
      </article>

      <!-- Card index 4: Operations Flow -->
      <article id="stat-operations" class="bg-white border border-slate-250/70 p-5 rounded-3xl shadow-3xs flex justify-between items-center relative overflow-hidden transition-all hover:scale-[1.01]">
        <div class="space-y-1.5 z-10 w-full">
          <span class="text-[10px] font-black uppercase text-slate-400 tracking-wider block">{{ currentLang === 'km' ? 'បរិមាណម្ហូបបានបម្រើ' : 'Plates Served Volume' }}</span>
          <h3 class="text-2xl font-black text-slate-900 font-display">{{ totalCovers }} {{ currentLang === 'km' ? 'ចាន' : 'plates' }}</h3>
          <div class="flex items-center justify-between text-[10px] text-slate-400 font-bold">
            <span>{{ currentLang === 'km' ? 'សំបុត្ររង់ចាំក្នុងចង្ក្រាន៖' : 'Kitchen backlog:' }} <strong>{{ kitchenStatusAggregation.pendingInKitchen }} {{ currentLang === 'km' ? 'សំបុត្រ' : 'tickets' }}</strong></span>
            <span class="text-emerald-600 font-semibold">{{ kitchenStatusAggregation.readyToServe }} {{ currentLang === 'km' ? 'រួចរាល់សម្រាប់ចែក' : 'ready to dispatch' }}</span>
          </div>
        </div>
        <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-xl">restaurant</span>
        </div>
      </article>

    </section>

    <!-- MIDDLE ROW: INTERACTIVE SALES TIMELINE & HOURLY PEAK ANALYTICS -->
    <section class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Timeline Visualizer Chart (2/3 width) -->
      <div id="analytics-sales-trend" class="lg:col-span-2 bg-white rounded-3xl border border-slate-250/75 p-6 shadow-3xs flex flex-col gap-5">
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 class="font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
              <span class="material-symbols-outlined text-primary text-base">analytics</span>
              {{ currentLang === 'km' ? 'សន្ទស្សន៍សកម្មភាពចំណូល និងខ្សែកោងការលក់' : 'Revenue Velocity & Settle Timelines' }}
            </h3>
            <p class="text-[10px] text-slate-400 font-bold mt-0.5">
              {{ currentLang === 'km' ? 'តម្លៃសរុបត្រូវបានគូរដោយប្រើការគណនា interpolation D3' : 'Aggregate values mapped using responsive D3 vector interpolations' }}
            </p>
          </div>

          <!-- Interactive toggle knobs -->
          <div class="flex items-center gap-2 flex-wrap">
            <!-- Metric Toggle -->
            <div class="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-[10px]">
              <button 
                @click="selectedMetric = 'sales'"
                class="px-2.5 py-1 rounded-md font-black uppercase transition-all outline-none"
                :class="selectedMetric === 'sales' ? 'bg-white text-primary shadow-3xs' : 'text-slate-500 hover:text-slate-950'"
              >
                {{ currentLang === 'km' ? 'ចំណូលលក់' : 'Revenue' }}
              </button>
              <button 
                @click="selectedMetric = 'covers'"
                class="px-2.5 py-1 rounded-md font-black uppercase transition-all outline-none"
                :class="selectedMetric === 'covers' ? 'bg-white text-primary shadow-3xs' : 'text-slate-500 hover:text-slate-950'"
              >
                {{ currentLang === 'km' ? 'ចំនួនមុខម្ហូប' : 'Portions' }}
              </button>
            </div>

            <!-- Timeframe selector -->
            <div class="flex border border-slate-200 rounded-lg p-0.5 bg-slate-50 text-[10px]">
              <button 
                v-for="timeframe in ['Day', 'Week', 'Month'] as const"
                :key="timeframe"
                @click="selectedTimeframe = timeframe"
                class="px-2.5 py-1 rounded-md font-black uppercase transition-all outline-none"
                :class="selectedTimeframe === timeframe ? 'bg-white text-primary shadow-3xs' : 'text-slate-500 hover:text-slate-950'"
              >
                {{ timeframe === 'Day' ? (currentLang === 'km' ? 'ថ្ងៃ' : 'Day') : timeframe === 'Week' ? (currentLang === 'km' ? 'សប្តាហ៍' : 'Week') : (currentLang === 'km' ? 'ខែ' : 'Month') }}
              </button>
            </div>
          </div>
        </div>

        <!-- The Responsive SVG Vector Graph Area -->
        <div class="flex-grow w-full relative pt-4 pb-2 bg-slate-50/[0.15] rounded-2xl border border-slate-150 p-4">
          
          <svg 
            class="w-full h-[180px] overflow-visible" 
            :viewBox="`0 0 ${d3ChartSvgPath.width} ${d3ChartSvgPath.height}`"
            preserveAspectRatio="none"
          >
            <!-- Draw Horizontal Grid ticks -->
            <g class="opacity-15">
              <line 
                v-for="tickY in d3ChartSvgPath.ticksY" 
                :key="'grid-'+tickY"
                x1="20" 
                :y1="d3ChartSvgPath.height - 20 - (tickY / Math.max(...salesHistoryChartData.map(d=>d.value), 50)) * (d3ChartSvgPath.height - 40)" 
                :x2="d3ChartSvgPath.width - 20" 
                :y2="d3ChartSvgPath.height - 20 - (tickY / Math.max(...salesHistoryChartData.map(d=>d.value), 50)) * (d3ChartSvgPath.height - 40)"
                stroke="#1e293b" 
                stroke-width="1.5"
                stroke-dasharray="3,3"
              />
            </g>

            <!-- Gradient Definition -->
            <defs>
              <linearGradient id="primaryGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ab5319" stop-opacity="0.3" />
                <stop offset="100%" stop-color="#ab5319" stop-opacity="0.0" />
              </linearGradient>
            </defs>

            <!-- Draw Area shaded region -->
            <path 
              v-if="d3ChartSvgPath.areaPath"
              :d="d3ChartSvgPath.areaPath" 
              fill="url(#primaryGrad)" 
            />

            <!-- Draw Core Line path -->
            <path 
              v-if="d3ChartSvgPath.linePath"
              :d="d3ChartSvgPath.linePath" 
              fill="none" 
              stroke="#ab5319" 
              stroke-width="3" 
              stroke-linecap="round"
              stroke-linejoin="round"
            />

            <!-- Data point Nodes -->
            <circle 
              v-for="(pt, idx) in d3ChartSvgPath.points" 
              :key="'pt-'+idx"
              :cx="pt.x" 
              :cy="pt.y" 
              r="5.5" 
              class="fill-white stroke-orange-700 stroke-2 cursor-pointer transition-all hover:r-7"
              @mouseenter="triggerHoverPoint(pt)"
              @mouseleave="clearHoverPoint"
            />
            
            <!-- Axis label ticks x -->
            <text 
              v-for="(pt, idx) in d3ChartSvgPath.points" 
              :key="'xaxis-'+idx"
              :x="pt.x" 
              :y="d3ChartSvgPath.height - 4" 
              class="text-[7.5px] font-black fill-slate-400 text-anchor-middle"
              text-anchor="middle"
            >
              {{ pt.label }}
            </text>
          </svg>

          <!-- Interactive Tooltip details popup -->
          <div 
            v-if="hoveredChartPoint"
            class="absolute bg-slate-900 text-white rounded-xl py-2 px-3 shadow-xl pointer-events-none text-[10px] font-black z-30 translate-x-[-50%] translate-y-[-110%] animate-in fade-in duration-100"
            :style="`left: ${(hoveredChartPoint.x / d3ChartSvgPath.width) * 100}%; top: ${(hoveredChartPoint.y / d3ChartSvgPath.height) * 100}%`"
          >
            <p class="text-slate-400 font-bold tracking-wide uppercase">{{ hoveredChartPoint.label }}</p>
            <p class="text-slate-100 text-xs mt-0.5">
              {{ selectedMetric === 'sales' ? '$' + hoveredChartPoint.val.toFixed(2) : hoveredChartPoint.val + ' Portions' }}
            </p>
          </div>

          <!-- Helper indicator when no data -->
          <div v-if="payoutHistory.length === 0" class="absolute inset-0 bg-white/70 backdrop-blur-3xs flex items-center justify-center flex-col text-center p-6">
            <span class="material-symbols-outlined text-slate-300 text-4xl mb-1">hourglass_empty</span>
            <p class="text-xs font-black text-slate-800 uppercase">
              {{ currentLang === 'km' ? 'កំពុងរង់ចាំប្រតិបត្តិការទូទាត់' : 'Awaiting transaction payouts' }}
            </p>
            <p class="text-[10px] text-slate-500 font-bold max-w-xs mt-1">
              {{ currentLang === 'km' ? 'រកមិនឃើញការបង់ប្រាក់ក្នុងកំណត់ត្រាឡើយ។ សូមចុចប៊ូតុង "បញ្ចូលទិន្នន័យគំរូ" ខាងលើដើម្បីបញ្ចូលទិន្នន័យសាកល្បងភ្លាមៗ។' : 'No payments found in shift records. Please click the "Infuse Sim Dataset" button inside the top toolbar to load immediate sandbox curves.' }}
            </p>
          </div>
        </div>

        <!-- Footnote totals info bar -->
        <div class="grid grid-cols-3 gap-3 bg-slate-50/50 p-4 border border-slate-150 rounded-2xl text-center text-xs">
          <div>
            <span class="block text-[8px] uppercase tracking-wide text-slate-400 font-bold mb-0.5">
              {{ currentLang === 'km' ? 'ទូទាត់តាមកាត' : 'Card Portals' }}
            </span>
            <strong class="text-slate-800 font-black">${{ payoutHistory.filter(h=>h.paymentMethod==='Credit Card').reduce((acc,h)=>acc+h.total, 0).toFixed(2) }}</strong>
          </div>
          <div class="border-x border-slate-200">
            <span class="block text-[8px] uppercase tracking-wide text-slate-400 font-bold mb-0.5">
              {{ currentLang === 'km' ? 'ម៉ាស៊ីនប្រាក់សុទ្ធ' : 'Cash Register' }}
            </span>
            <strong class="text-slate-800 font-black">${{ payoutHistory.filter(h=>h.paymentMethod==='Cash').reduce((acc,h)=>acc+h.total, 0).toFixed(2) }}</strong>
          </div>
          <div>
            <span class="block text-[8px] uppercase tracking-wide text-slate-400 font-bold mb-0.5">
              {{ currentLang === 'km' ? 'គណនីទូរស័ព្ទចល័ត' : 'Contactless Mobile' }}
            </span>
            <strong class="text-slate-800 font-black">${{ payoutHistory.filter(h=>h.paymentMethod==='Mobile Pay').reduce((acc,h)=>acc+h.total, 0).toFixed(2) }}</strong>
          </div>
        </div>
      </div>

      <!-- Traffic Peaks Heatmap Breakdown (1/3 width) -->
      <div id="analytics-traffic-heatmap" class="bg-white rounded-3xl border border-slate-250/75 p-6 shadow-3xs flex flex-col justify-between gap-5">
        <div>
          <h3 class="font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">schedule</span>
            {{ currentLang === 'km' ? 'ដង់ស៊ីតេម៉ោងមមាញឹកអាហារល្ងាច' : 'Peak Dinner Hour Densities' }}
          </h3>
          <p class="text-[10px] text-slate-400 font-bold mt-0.5">
            {{ currentLang === 'km' ? 'កំណត់អត្តសញ្ញាណល្បឿនសំបុត្រដែលមមាញឹកបំផុតតាមម៉ោងនីមួយៗ' : 'Identify peak ticket velocities categorized by dining intervals' }}
          </p>
        </div>

        <!-- Custom progress density blocks -->
        <div class="space-y-3.5 flex-grow py-2">
          <div 
            v-for="segment in peakHourlySegments" 
            :key="segment.span"
            class="space-y-1.5 p-3 rounded-2xl border border-slate-100 hover:border-slate-200 bg-slate-50/[0.12] transition-all"
          >
            <div class="flex justify-between items-center text-xs">
              <div>
                <h5 class="font-black text-slate-800 truncate">
                  {{
                    segment.segment === 'Breakfast Rush' ? (currentLang === 'km' ? 'អាហារពេលព្រឹកមមាញឹក' : 'Breakfast Rush') :
                    segment.segment === 'Lunch Rush' ? (currentLang === 'km' ? 'អាហារថ្ងៃត្រង់មមាញឹក' : 'Lunch Rush') :
                    segment.segment === 'Afternoon Quiet' ? (currentLang === 'km' ? 'ពេលរសៀលស្ងប់ស្ងាត់' : 'Afternoon Quiet') :
                    (currentLang === 'km' ? 'កំពូលម៉ោងអាហារល្ងាច' : 'Dinner Peak')
                  }}
                </h5>
                <h6 class="text-[9px] text-slate-400 font-bold mt-0.5">{{ segment.span }}</h6>
              </div>
              <span class="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                {{ segment.count }} {{ currentLang === 'km' ? 'ចាន' : 'Plates' }}
              </span>
            </div>

            <!-- Visual Bar -->
            <div class="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div 
                class="h-full bg-primary rounded-full transition-all duration-500"
                :style="`width: ${segment.density}%`"
                :class="segment.density > 60 ? 'bg-primary' : segment.density > 30 ? 'bg-orange-800/80' : 'bg-orange-850/65'"
              ></div>
            </div>
            <div class="text-[8px] font-bold text-slate-400 text-right uppercase tracking-wider">
              {{ currentLang === 'km' ? 'ទម្ងន់ដង់ស៊ីតេ៖' : 'Density weight:' }} {{ segment.density }}%
            </div>
          </div>
        </div>

        <div class="bg-primary/5 border border-primary/10 rounded-2xl p-4.5 text-[10px] font-extrabold text-orange-950/90 leading-relaxed flex items-start gap-2.5 shrink-0">
          <span class="material-symbols-outlined text-sm text-primary shrink-0">tips_and_updates</span>
          <p>
            {{ currentLang === 'km'
              ? 'ម៉ោងកំពូលអាហារល្ងាចកើនឡើងដល់ទៅ ៣,២ដង។ សូមរៀបចំតារាងម៉ោងបុគ្គលិកឲ្យបានត្រឹមត្រូវ ដើម្បីកាត់បន្ថយពេលវេលារង់ចាំរបស់ភ្ញៀវ។'
              : 'Dinner Peak hour clusters see a 3.2x multiplier. Ensure adequate staff scheduling during late cycles to reduce customer delivery wait times.'
            }}
          </p>
        </div>
      </div>

    </section>

    <!-- BOTTOM ROW: POPULAR DISH PERFORMANCE & TABLE YIELDS RANKINGS -->
    <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      
      <!-- Top Dishes breakdown list -->
      <div id="analytics-dish-ranking" class="bg-white rounded-3xl border border-slate-250/75 p-6 shadow-3xs flex flex-col gap-5">
        <div>
          <h3 class="font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
            <span class="material-symbols-outlined text-emerald-600 text-base">restaurant_menu</span>
            {{ currentLang === 'km' ? 'សន្ទស្សន៍ប្រសិទ្ធភាពម្ហូបក្នុងបញ្ជីពេញនិយម' : 'Popular Menu Item Performance Metrics' }}
          </h3>
          <p class="text-[10px] text-slate-400 font-bold mt-0.5">
            {{ currentLang === 'km' ? 'ការគណនាចំណាត់ថ្នាក់មុខម្ហូបដែលបានលក់សរុបទាំងអស់' : 'Calculated rankings of products sorted by total aggregate sales' }}
          </p>
        </div>

        <div class="overflow-hidden border border-slate-200/60 rounded-2xl bg-slate-50/[0.05] max-h-[350px] overflow-y-auto custom-scrollbar">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-slate-50/70 border-b border-slate-250/50">
                <th class="px-5 py-3 text-[10px] uppercase font-black text-slate-400">{{ currentLang === 'km' ? 'មុខម្ហូប' : 'Plata / Dish' }}</th>
                <th class="px-5 py-3 text-[10px] uppercase font-black text-slate-400">{{ currentLang === 'km' ? 'ប្រភេទ' : 'Class' }}</th>
                <th class="px-5 py-3 text-[10px] uppercase font-black text-slate-400">{{ currentLang === 'km' ? 'ចំនួនកម្ម៉ង់' : 'Units Demanded' }}</th>
                <th class="px-5 py-3 text-[10px] uppercase font-black text-slate-400 text-right">{{ currentLang === 'km' ? 'ចំណូលសរុប' : 'Sum Generated' }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 font-bold text-xs text-slate-700 bg-white">
              <tr 
                v-for="(dish, index) in popularDishRanking" 
                :key="dish.name"
                class="hover:bg-slate-50/50 transition-colors"
              >
                <!-- Ranking Name -->
                <td class="px-5 py-3.5 flex items-center gap-3">
                  <span class="w-5 h-5 rounded-md flex items-center justify-center font-black text-[9px]"
                    :class="[
                      index === 0 ? 'bg-amber-100 text-amber-800' :
                      index === 1 ? 'bg-slate-200 text-slate-600' :
                      index === 2 ? 'bg-orange-100 text-orange-800' : 'bg-slate-50 text-slate-400'
                    ]">
                    #{{ index + 1 }}
                  </span>
                  <span class="font-black text-slate-900">{{ translateDishName(dish.name) }}</span>
                </td>

                <!-- Category -->
                <td class="px-5 py-3.5">
                  <span class="px-2 py-0.5 rounded text-[9px] uppercase font-bold"
                    :class="[
                      dish.category === 'Burger' ? 'bg-amber-100/50 text-amber-800' :
                      dish.category === 'Pizza' ? 'bg-red-100/50 text-red-800' :
                      dish.category === 'Beverage' ? 'bg-purple-100/50 text-purple-800' : 'bg-slate-100 text-slate-500'
                    ]"
                  >
                    {{ dish.category === 'Burger' ? (currentLang === 'km' ? 'ប៊ឺហ្គឺ' : 'Burger') : dish.category === 'Pizza' ? (currentLang === 'km' ? 'ភីហ្សា' : 'Pizza') : dish.category === 'Beverage' ? (currentLang === 'km' ? 'ភេសជ្ជៈ' : 'Beverage') : dish.category === 'Snack' ? (currentLang === 'km' ? 'អាហារសម្រន់' : 'Snack') : dish.category === 'Entrée' ? (currentLang === 'km' ? 'ម្ហូបចម្បង' : 'Entrée') : (currentLang === 'km' ? 'ផ្សេងៗ' : dish.category) }}
                  </span>
                </td>

                <!-- Quantity -->
                <td class="px-5 py-3.5 font-black text-slate-800">
                  x{{ dish.count }}
                </td>

                <!-- Revenue sum -->
                <td class="px-5 py-3.5 text-right font-black text-primary">
                  ${{ dish.totalSales.toFixed(2) }}
                </td>
              </tr>

              <tr v-if="popularDishRanking.length === 0">
                <td colspan="4" class="text-center py-16 text-slate-400 font-bold bg-slate-50/10">
                  {{ currentLang === 'km' ? 'មិនទាន់មានទិន្នន័យម្ហូបត្រូវបានដំណើរការក្នុងប្រព័ន្ធនៅឡើយទេ។ កំណត់ត្រានឹងចងក្រងនៅពេលទូទាត់ប្រាក់។' : 'No items are processed in system history yet. Demands log compiles on checkout.' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Desk Yield efficiency matrix -->
      <div id="analytics-table-yield" class="bg-white rounded-3xl border border-slate-250/75 p-6 shadow-3xs flex flex-col gap-5">
        <div>
          <h3 class="font-black text-sm text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
            <span class="material-symbols-outlined text-primary text-base">table_restaurant</span>
            {{ currentLang === 'km' ? 'ប្រសិទ្ធភាព និងចំណូលតុអាហារនីមួយៗ' : 'Dining Table Settle Efficiency & Yields' }}
          </h3>
          <p class="text-[10px] text-slate-400 font-bold mt-0.5">
            {{ currentLang === 'km' ? 'កំណត់សម្គាល់ការរៀបចំកៅអីដែលមានចំណូលខ្ពស់ និងល្បឿននៃការគិតប្រាក់' : 'Identify highest-yield seating arrangements and checkout velocities' }}
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div 
            v-for="table in tableYields" 
            :key="table.tableNo"
            class="border border-slate-200 rounded-2xl p-4 flex items-center gap-3.5 bg-slate-50/[0.08] hover:bg-slate-100/50 transition-all cursor-default"
          >
            <!-- Desk Indicator Badge -->
            <div class="w-11 h-11 rounded-xl bg-slate-800 text-white flex flex-col items-center justify-center shrink-0 shadow-3xs font-black">
              <span class="text-[7px] uppercase opacity-75">TBL</span>
              <span class="text-xs leading-none mt-0.5">{{ table.tableNo }}</span>
            </div>

            <!-- Table yield details -->
            <div class="min-w-0 flex-1">
              <div class="flex justify-between items-center">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  {{ currentLang === 'km' ? 'ចំណូលសរុបបាន៖' : 'Aggregate Sum' }}
                </span>
                <span class="text-xs font-black text-primary">${{ table.totalRevenue.toFixed(2) }}</span>
              </div>
              
              <!-- Completion sessions list bar -->
              <div class="flex items-center gap-1 mt-1 text-[10px] text-slate-500 font-bold">
                <span class="material-symbols-outlined text-xs">room_service</span>
                <span>{{ table.count }} {{ currentLang === 'km' ? 'វេនដោះស្រាយរួចរាល់' : 'historical sessions settled' }}</span>
              </div>

              <!-- Cycle rating metric indicator -->
              <div class="mt-2 text-[8px] uppercase tracking-widest font-black text-emerald-600 flex items-center gap-1"
                v-if="table.totalRevenue > 60">
                <span class="w-1 h-1 rounded-full bg-emerald-500"></span>
                {{ currentLang === 'km' ? 'កម្រិត៖ ការប្រើប្រាស់តុលេចធ្លោខ្លាំង' : 'Grade: Exceptional desk occupancy' }}
              </div>
              <div class="mt-2 text-[8px] uppercase tracking-widest font-black text-slate-400 flex items-center gap-1"
                v-else>
                <span class="w-1 h-1 rounded-full bg-slate-400"></span>
                {{ currentLang === 'km' ? 'កម្រិត៖ ការប្រើប្រាស់តុមធ្យម' : 'Grade: Average desk occupancy' }}
              </div>
            </div>
          </div>

          <!-- Empty placeholder yield -->
          <div v-if="tableYields.length === 0" class="col-span-2 text-center py-16 text-slate-400 font-bold border border-dashed border-slate-200 rounded-2xl">
            {{ currentLang === 'km' ? 'មិនទាន់មានតុដែលប្រើប្រាស់ត្រូវបានកត់ត្រានៅឡើយទេ។ សូមទូទាត់ប្រាក់ឱ្យអតិថិជន ដើម្បីបង្ហាញការវិភាគតុ។' : 'No occupied desks registered yet. Settle customer checks inside Cashier interface to populate seating analytics.' }}
          </div>
        </div>
      </div>

    </section>

    <!-- FLOATING NO DATA TOAST -->
    <div 
      v-if="toastMessage"
      class="fixed bottom-6 right-6 bg-slate-900 border border-slate-800 text-white py-3.5 px-5 rounded-2xl shadow-2xl flex items-center gap-3 z-50 font-bold text-xs animate-in slide-in-from-bottom duration-300 max-w-sm"
    >
      <span class="material-symbols-outlined text-primary font-black text-sm">notifications</span>
      <p class="text-slate-100 pr-4 leading-normal">{{ toastMessage }}</p>
      <button @click="toastMessage = null" class="text-slate-400 hover:text-white transition-colors shrink-0 font-bold ml-auto animate-none">
        <span class="material-symbols-outlined text-xs">close</span>
      </button>
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
