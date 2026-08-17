<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { 
  t, 
  currentLang, 
  setLang, 
  translateDishName, 
  translateDishDesc, 
  translateIngredient 
} from '../i18n'
import { menuService } from '../services/menu.js'
import { orderService } from '../services/orders.js'
import { notificationService } from '../services/notifications.js'
import { getSocket, joinTableRoom } from '../services/socket.js'
import { login } from '../services/auth.js'
import { getAccessToken } from '../services/api.js'

const route = useRoute()

const getCategoryDisplayName = (catName: string) => {
  const normalized = catName.toLowerCase().replace(/\s+/g, '')
  if (normalized === 'allmenu') return t('allMenu')
  if (normalized === 'bakery') return t('bakery')
  if (normalized === 'burger') return t('burger')
  if (normalized === 'beverage') return t('beverage')
  if (normalized === 'chicken') return t('chicken')
  if (normalized === 'pizza') return t('pizza')
  if (normalized === 'seafood') return t('seafood')
  return catName
}

const defaultCategories = [
  { name: 'All Menu', icon: 'grid_view', active: true },
  { name: 'Bakery', icon: 'bakery_dining', active: false },
  { name: 'Burger', icon: 'lunch_dining', active: false },
  { name: 'Beverage', icon: 'local_bar', active: false },
  { name: 'Chicken', icon: 'dinner_dining', active: false },
  { name: 'Pizza', icon: 'local_pizza', active: false },
  { name: 'Seafood', icon: 'set_meal', active: false }
]

const activeCategory = ref('All Menu')

const loadCategoriesFromStorage = () => {
  const stored = localStorage.getItem('gomeal_categories')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const oldActive = activeCategory.value
      let cats = parsed.map((c: any) => ({ ...c, active: c.name.toLowerCase() === oldActive.toLowerCase() }))
      const hasAllMenu = cats.some((c: any) => c.name.toLowerCase() === 'all menu')
      if (!hasAllMenu) {
        cats.unshift({ name: 'All Menu', icon: 'grid_view', active: oldActive.toLowerCase() === 'all menu' })
      } else {
        const allMenu = cats.find((c: any) => c.name.toLowerCase() === 'all menu')
        if (allMenu) allMenu.active = oldActive.toLowerCase() === 'all menu'
      }
      return cats
    } catch (e) {
      console.error(e)
    }
  }
  const oldActive = activeCategory.value
  return defaultCategories.map(c => ({ ...c, active: c.name.toLowerCase() === oldActive.toLowerCase() }))
}

const categories = ref(loadCategoriesFromStorage())

const selectCategory = (catName: string) => {
  activeCategory.value = catName
  categories.value.forEach((cat: any) => {
    cat.active = cat.name.toLowerCase() === catName.toLowerCase()
  })
}

const defaultMenuItems = [
  {
    id: 1,
    name: 'Cheese Burger',
    price: 12.50,
    description: 'Classic beef patty with double cheddar cheese and secret sauce.',
    ingredients: [
      { name: 'Beef Patty', amount: 1, unit: 'pcs' },
      { name: 'Double Cheddar', amount: 2, unit: 'pcs' },
      { name: 'Lettuce', amount: 0.1, unit: 'kg' },
      { name: 'Tomato', amount: 0.05, unit: 'kg' },
      { name: 'Pickles', amount: 3, unit: 'pcs' }
    ],
    status: 'Available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_58biya1paABTH6IL_cgl_57LeZ4J5ymsHNKEy_VgPxuOxJsNzXiFFL135exa1t8AFxAE6I2fw5HKu9sHfNi9f41xaGgw4NHdDHoFGJ3h0leJQEHhoHysmGLRxhQglZXOUTufuK9mHEbWp_8WFmSd3I687QvKMW_7--1nuVG5f9exmfqQTX38IjGOQI0saGNCydZ5B9nsRTYYoocZY18TGGQzVSVqgxv7r-xbwN3vB_Ia08uSSmBQQ3u1IkcUBkKEXrguPvWYPwE'
  },
  {
    id: 2,
    name: 'Pepperoni Pizza',
    price: 18.99,
    description: 'Thin crust loaded with spicy pepperoni and fresh basil leaves.',
    ingredients: [
      { name: 'Pepperoni', amount: 0.15, unit: 'kg' },
      { name: 'Mozzarella', amount: 0.25, unit: 'kg' },
      { name: 'Tomato Sauce', amount: 0.1, unit: 'kg' },
      { name: 'Basil', amount: 5, unit: 'pcs' }
    ],
    status: 'Available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBn_wQVFevzLu7CLLK6i1DUbE4eUpTsNcL2p1TlHzbasPYJ43fxF_KY9mRVhUMxxkwowt4nE6ZwAhQwrmJZhBoqjI5iHvrGm9Etl8sRi72FAXlcXfMX5XPXgBDUc3gRFI6WikKkXjLO8OEfi4js9K1axMXIW1NmE_2q96u97b8gMHqLs4q0Fd_1eKSCI3ohngtjWsOU-zsYqO6dCUgqvE5p30HKZanVNmN5i53eSh2EAsKg5mNhsif8WaIQAH9XHl4dar45pCrX_58'
  },
  {
    id: 3,
    name: 'Japanese Ramen',
    price: 15.00,
    description: 'Creamy pork broth with handmade noodles and chashu pork.',
    ingredients: [
      { name: 'Pork Chashu', amount: 2, unit: 'pcs' },
      { name: 'Ramen Noodles', amount: 0.2, unit: 'kg' },
      { name: 'Soft Boiled Egg', amount: 1, unit: 'pcs' },
      { name: 'Nori', amount: 2, unit: 'pcs' }
    ],
    status: 'Sold Out',
    lowStock: true,
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkQEYh62Uq3uI0scRBpNgbuk1ev0ew2sBJf7uQcaylYTswLRyJXkdb73XpedlHXlmKg4c0jqAUERG2j6EdTIhay4NJ8I_UBYy1JLj72razpWKissFHWCd3sCYqR5PiMLihgTzqKlE4OwT2QyUIMNYW2atLNB7-IaXY_o6ttjhNiUQRhQOd3iq_cnWNSvAcFgxsJFaZaBhXgIaVuiiigWycOSnRTFUAM26Q4RYa8cT__JA2Gz_kE7ub-rTXjCqiGtstZ4xxSqtN8fY'
  },
  {
    id: 4,
    name: 'Fried Rice',
    price: 10.45,
    description: 'Wok-fried rice with assorted vegetables and authentic spices.',
    ingredients: [
      { name: 'Rice', amount: 0.3, unit: 'kg' },
      { name: 'Shrimp', amount: 8, unit: 'pcs' },
      { name: 'Eggs', amount: 2, unit: 'pcs' },
      { name: 'Green Beans', amount: 0.05, unit: 'kg' },
      { name: 'Carrots', amount: 0.05, unit: 'kg' }
    ],
    status: 'Available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeoQ8xKRkzOfh3Z60Ys1Jmz5dtxwaQ2At2vXesV1lrlwYme3Hlaxi1cBmQKNqkdBEHPRNwWPGwNYHUgR0zq_exdP5bSQNfaMUStNv-E_5TeKbRDtrTIj5lh9Jshm_DE4Gj-5a6nzvt5AbxnQx_1gdHVFOUBPbarRNw1CtCuQigr5SmI-7piZPF-3eUiNv1IydEzZ3wgzzk7uYgNOJz0motcUBOwkJRZLpvnWD09MJa4hsjatq62s8bFFlplAyN0mvgZDQi56in_qA'
  },
  {
    id: 5,
    name: 'Vegan Salad',
    price: 13.20,
    description: 'Fresh organic garden greens with avocado and citrus dressing.',
    ingredients: [
      { name: 'Avocado', amount: 1, unit: 'pcs' },
      { name: 'Quinoa', amount: 0.1, unit: 'kg' },
      { name: 'Baby Spinach', amount: 0.15, unit: 'kg' },
      { name: 'Citrus Dressing', amount: 2, unit: 'portions' }
    ],
    status: 'Available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2f87RJ0hfrSnVevXnLA3Lg8MNMeEkQvS9epwQ1cL-bucPLyQ3nfQw1Jh4TJnGyd_6AJFchvYZg2gK9EA3mvZYqNqCW5wuGU10hkFexUycT8COdSumTWAt8D8HLWfOIMT5uLXz6rX22v-nUSjLTJYoI8zouLgvXnhi5CJX2Febib8skbVb8-EsD7SFKauxL1NhYbtjBQBzEeg1w868Rs3s2RPeYW71C-ciiZn85xTWGNqs930ixpjkrYK3VDEQ38sfaya9lG9Xe4I'
  },
  {
    id: 6,
    name: 'Berry Smoothie',
    price: 7.50,
    description: 'Antioxidant rich blend of blueberries, strawberries and almond milk.',
    ingredients: [
      { name: 'Blueberries', amount: 0.08, unit: 'kg' },
      { name: 'Strawberries', amount: 0.12, unit: 'kg' },
      { name: 'Almond Milk', amount: 0.25, unit: 'kg' },
      { name: 'Chia Seeds', amount: 1, unit: 'portions' }
    ],
    status: 'Available',
    image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbFAS4iTYwi5ycdwRD7J95XSa-Omxa-O1JYiDMcakgZuHILdB0DIGPpRVDxDYfDJ4D_s4QJK8wo-vWQEjqFT-ixPcVEqpXrh41stH45aQ4LRjLE2aqSQ3O8nn2CQH6nX6bpDQ8ezZG73QPe7p-FVFt2nWNT8YrC-ZCvg6tku66rzTC4Rd5QdjQipy6xPNsUpjh1Ohei6AXpwFzSShIBoF_mLn3T_dq-rh1JYWe1k3Shoj_2qDne3ec0X-bsvwTAvIDfhzQBVFIhs8'
  }
]

const loadMenuItems = () => {
  const stored = localStorage.getItem('gomeal_menu_items')
  if (stored) {
    try {
      const items = JSON.parse(stored)
      return items.map((item: any) => ({
        ...item,
        ingredients: (item.ingredients || []).map((ing: any) => {
          if (typeof ing === 'string') {
            return { name: ing, amount: 1, unit: 'pcs' }
          }
          return ing
        })
      }))
    } catch (e) {
      console.error(e)
    }
  }
  return defaultMenuItems
}

const menuItems = ref(loadMenuItems())

const searchQuery = ref('')

const filteredMenuItems = computed(() => {
  let items = menuItems.value
  if (activeCategory.value !== 'All Menu') {
    items = items.filter((item: any) => {
      const name = item.name.toLowerCase()
      const desc = item.description.toLowerCase()
      const cat = activeCategory.value.toLowerCase()
      
      if (cat === 'burger') return name.includes('burger') || desc.includes('burger') || name.includes('patty')
      if (cat === 'pizza') return name.includes('pizza') || desc.includes('pizza')
      if (cat === 'beverage' || cat === 'bar') return name.includes('smoothie') || name.includes('juice') || name.includes('tea') || name.includes('drink') || name.includes('shake') || name.includes('milk') || name.includes('beverage') || name.includes('cafe')
      if (cat === 'seafood') return name.includes('fish') || name.includes('shrimp') || name.includes('seafood') || name.includes('crab') || name.includes('lobster')
      if (cat === 'chicken') return name.includes('chicken') || name.includes('poultry') || name.includes('wings')
      if (cat === 'bakery') return name.includes('bread') || name.includes('bakery') || name.includes('donut') || name.includes('croissant') || name.includes('cake')
      
      return name.includes(cat) || desc.includes(cat)
    })
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    items = items.filter((item: any) => {
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    })
  }

  return items
})

const bestSellers = [
  { name: 'Pepperoni Pizza', price: 18.99, sold: '1k', growth: '+15%', image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&q=80&w=200' },
  { name: 'Japanese Ramen', price: 15.00, sold: '1.2k', growth: '+20%', image: 'https://images.unsplash.com/photo-1557872245-741744bc7583?auto=format&fit=crop&q=80&w=200' },
  { name: 'Fried Rice', price: 10.45, sold: '800', growth: '+12%', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=200' },
  { name: 'Cheese Burger', price: 12.50, sold: '2.5k', growth: '+35%', image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_58biya1paABTH6IL_cgl_57LeZ4J5ymsHNKEy_VgPxuOxJsNzXiFFL135exa1t8AFxAE6I2fw5HKu9sHfNi9f41xaGgw4NHdDHoFGJ3h0leJQEHhoHysmGLRxhQglZXOUTufuK9mHEbWp_8WFmSd3I687QvKMW_7--1nuVG5f9exmfqQTX38IjGOQI0saGNCydZ5B9nsRTYYoocZY18TGGQzVSVqgxv7r-xbwN3vB_Ia08uSSmBQQ3u1IkcUBkKEXrguPvWYPwE' }
]

// Personalization Modal
const isPersonalizeModalOpen = ref(false)
const personalizingItem = ref<any>(null)
const personalizedIngredients = ref<any[]>([])

// Overall Item Quantities representation
const itemQuantities = ref<Record<number, number>>({})
const personalizeQuantity = ref(1)

const getItemQuantity = (id: number) => {
  if (itemQuantities.value[id] === undefined) {
    itemQuantities.value[id] = 1
  }
  return itemQuantities.value[id]
}

const incrementItemQuantity = (id: number) => {
  const current = getItemQuantity(id)
  itemQuantities.value[id] = current + 1
}

const decrementItemQuantity = (id: number) => {
  const current = getItemQuantity(id)
  if (current > 1) {
    itemQuantities.value[id] = current - 1
  }
}

const openPersonalize = (item: any) => {
  personalizingItem.value = item
  // Set default customize quantity to the card's current quantity
  personalizeQuantity.value = getItemQuantity(item.id)
  if (item.ingredients) {
    personalizedIngredients.value = item.ingredients.map((ing: any) => {
      if (typeof ing === 'string') {
        return { name: ing, amount: 1, unit: 'pcs', originalAmount: 1 }
      }
      return { 
        name: ing.name, 
        amount: ing.amount, 
        unit: ing.unit,
        originalAmount: ing.amount 
      }
    })
  } else {
    personalizedIngredients.value = []
  }
  isPersonalizeModalOpen.value = true
}

const adjustCustomerIngredient = (idx: number, isAddition: boolean) => {
  const ing = personalizedIngredients.value[idx]
  if (!ing) return
  
  const step = ing.unit === 'kg' ? 0.05 : 1
  if (isAddition) {
    ing.amount = +(ing.amount + step).toFixed(2)
  } else {
    ing.amount = Math.max(0, +(ing.amount - step).toFixed(2))
  }
}

// Active Orders management & tracker
const currentTable = ref(localStorage.getItem('gomeal_selected_table') || '12B')
const guestName = ref(localStorage.getItem('gomeal_customer_name') || '')
const allOrders = ref<any[]>([])

const loadOrders = () => {
  const stored = localStorage.getItem('gomeal_customer_orders')
  if (stored) {
    try {
      allOrders.value = JSON.parse(stored)
      return
    } catch (e) {
      console.error(e)
    }
  }
  const defaultOrders = [
    {
      id: 111,
      name: 'Cheese Burger',
      price: 12.50,
      quantity: 2,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_58biya1paABTH6IL_cgl_57LeZ4J5ymsHNKEy_VgPxuOxJsNzXiFFL135exa1t8AFxAE6I2fw5HKu9sHfNi9f41xaGgw4NHdDHoFGJ3h0leJQEHhoHysmGLRxhQglZXOUTufuK9mHEbWp_8WFmSd3I687QvKMW_7--1nuVG5f9exmfqQTX38IjGOQI0saGNCydZ5B9nsRTYYoocZY18TGGQzVSVqgxv7r-xbwN3vB_Ia08uSSmBQQ3u1IkcUBkKEXrguPvWYPwE',
      status: 'Preparing', // 'Preparing' | 'Sent to Kitchen' | 'Served'
      customizations: 'Double Cheddar: 2 -> 3 pcs',
      tableNo: '12B',
      timePlaced: '10 mins ago'
    },
    {
      id: 222,
      name: 'Berry Smoothie',
      price: 7.50,
      quantity: 1,
      image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbFAS4iTYwi5ycdwRD7J95XSa-Omxa-O1JYiDMcakgZuHILdB0DIGPpRVDxDYfDJ4D_s4QJK8wo-vWQEjqFT-ixPcVEqpXrh41stH45aQ4LRjLE2aqSQ3O8nn2CQH6nX6bpDQ8ezZG73QPe7p-FVFt2nWNT8YrC-ZCvg6tku66rzTC4Rd5QdjQipy6xPNsUpjh1Ohei6AXpwFzSShIBoF_mLn3T_dq-rh1JYWe1k3Shoj_2qDne3ec0X-bsvwTAvIDfhzQBVFIhs8',
      status: 'Served',
      customizations: 'Standard Portions',
      tableNo: '04',
      timePlaced: '5 mins ago'
    }
  ]
  localStorage.setItem('gomeal_customer_orders', JSON.stringify(defaultOrders))
  allOrders.value = defaultOrders
}

const myOrders = computed(() => {
  return allOrders.value.filter((o: any) => o.tableNo === currentTable.value)
})

const activeDisplayOrders = computed(() => {
  return myOrders.value.filter((o: any) => o.status !== 'Served')
})

const isOrdersModalOpen = ref(false)
const isPaymentQrModalOpen = ref(false)
const billingAmount = ref(0)
const qrType = ref<'dynamic' | 'static'>('dynamic')

// ABA Pay Direct Launch & Sandbox Simulation States
const isAbaSimulatorOpen = ref(false)
const isPayingSimulating = ref(false)
const isPayingSucceed = ref(false)
const sliderValue = ref(0)
const paymentSimulatedTxId = ref('')

const playSuccessChime = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, start)
      
      gain.gain.setValueAtTime(0, start)
      gain.gain.linearRampToValueAtTime(0.15, start + 0.05)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + duration)
    }
    const now = ctx.currentTime
    playTone(523.25, now, 0.4) // C5
    playTone(659.25, now + 0.12, 0.4) // E5
    playTone(783.99, now + 0.24, 0.6) // G5
  } catch (err) {
    console.error('Audio synthesizer not supported or blocked by permissions', err)
  }
}

const triggerAbaDeepLink = () => {
  const khqr = qrType.value === 'dynamic' ? khqrData.value : staticKhqrData.value
  const deepLinkUrl = `https://payment.bakong.org.kh/pay?code=${encodeURIComponent(khqr)}`
  try {
    window.open(deepLinkUrl, '_blank')
  } catch (err) {
    console.warn('Redirect blocked by browser popup blocker. User can launch manually using the button.', err)
  }
}

const executeSimulationPayment = async () => {
  if (isPayingSimulating.value || isPayingSucceed.value) return
  isPayingSimulating.value = true
  
  const currentTableValue = currentTable.value || '02'
  
  // Call backend payment API
  try {
    await orderService.payTable(currentTableValue)
  } catch (apiErr) {
    console.log('Backend payment notice:', apiErr)
  }

  setTimeout(() => {
    isPayingSimulating.value = false
    isPayingSucceed.value = true
    playSuccessChime()
    
    // Settle the bill directly in state
    const tableOrders = allOrders.value.filter((o: any) => o.tableNo === currentTableValue)
    
    // Create new transaction receipt inside gomeal_payout_history
    const rawHistory = localStorage.getItem('gomeal_payout_history')
    let history: any[] = []
    if (rawHistory) {
      try {
        history = JSON.parse(rawHistory)
      } catch (err) {
        console.error(err)
      }
    }
    
    paymentSimulatedTxId.value = `TXN-${Math.floor(10000 + Math.random() * 90000)}`
    
    const newTx = {
      id: paymentSimulatedTxId.value,
      timestamp: Date.now(),
      tableNo: currentTableValue,
      customerName: tableOrders[0]?.customerName || `Guest Table #${currentTableValue}`,
      items: tableOrders.map((i: any) => ({
        name: i.name,
        price: i.price,
        quantity: i.quantity
      })),
      subtotal: orderSubtotal.value,
      tax: orderTax.value,
      serviceFee: orderServiceFee.value,
      total: orderTotal.value,
      paymentMethod: 'Mobile Pay'
    }
    
    history.unshift(newTx)
    localStorage.setItem('gomeal_payout_history', JSON.stringify(history))
    
    // Clear those active settled orders from customer orders database
    allOrders.value = allOrders.value.filter((o: any) => o.tableNo !== currentTableValue)
    localStorage.setItem('gomeal_customer_orders', JSON.stringify(allOrders.value))
    
    // Force browser storage update notification
    window.dispatchEvent(new Event('storage'))

    // Automatically hide this card/modal 2 seconds after success
    setTimeout(() => {
      isPaymentQrModalOpen.value = false
      resetSimulationState()
    }, 2000)
  }, 1800)
}

const resetSimulationState = () => {
  isAbaSimulatorOpen.value = false
  isPayingSimulating.value = false
  isPayingSucceed.value = false
  sliderValue.value = 0
  paymentSimulatedTxId.value = ''
}

const payWithSimulatorDirectly = () => {
  isAbaSimulatorOpen.value = true
  executeSimulationPayment()
}

// Helper to format tags for EMVCo/KHQR standard compliance
const getEmvTag = (tag: string, value: string): string => {
  const len = value.length.toString().padStart(2, '0')
  return `${tag}${len}${value}`
}

// Helper to compute CRC-16 CCITT
const calculateCrc16 = (data: string): string => {
  let crc = 0xFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
      crc &= 0xFFFF
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

// Dynamic Bill KHQR: Prefills exact amount and table details
const khqrData = computed(() => {
  const amountStr = billingAmount.value.toFixed(2)
  const tableStr = currentTable.value || '02'
  
  const t00 = '000201' // Payload Format Indicator
  const t01 = '010212' // Dynamic Point-of-Initiation
  
  // Tag 38 (Merchant Account Info - Bakong Template)
  // Sub 00 (Account/UUID): 0112185250100438, Sub 01: gomeal01, Sub 02: PHNOMPENH
  const sub00 = getEmvTag('00', '0112185250100438')
  const sub01 = getEmvTag('01', 'gomeal01')
  const sub02 = getEmvTag('02', 'PHNOMPENH')
  const t38 = getEmvTag('38', sub00 + sub01 + sub02)
  
  const t52 = '52045811' // Restaurant MCC
  const t53 = '5303840'  // USD Currency
  const t54 = getEmvTag('54', amountStr) // Amount
  const t58 = '5802KH'   // Country
  const t59 = getEmvTag('59', 'Gomeal Restaurant')
  const t60 = getEmvTag('60', 'Phnom Penh')
  
  const sub07 = getEmvTag('07', `Table #${tableStr}`)
  const t62 = getEmvTag('62', sub07)
  
  const partial = t00 + t01 + t38 + t52 + t53 + t54 + t58 + t59 + t60 + t62 + '6304'
  return partial + calculateCrc16(partial)
})

// Static Merchant KHQR: Keeps it the raw/original QR code pattern
const staticKhqrData = computed(() => {
  const tableStr = currentTable.value || '02'
  
  const t00 = '000201' // Payload Format Indicator
  const t01 = '010211' // Static Point-of-Initiation
  
  const sub00 = getEmvTag('00', '0112185250100438')
  const sub01 = getEmvTag('01', 'gomeal01')
  const sub02 = getEmvTag('02', 'PHNOMPENH')
  const t38 = getEmvTag('38', sub00 + sub01 + sub02)
  
  const t52 = '52045811' // Restaurant MCC
  const t53 = '5303840'  // USD Currency
  const t58 = '5802KH'   // Country
  const t59 = getEmvTag('59', 'Gomeal Restaurant')
  const t60 = getEmvTag('60', 'Phnom Penh')
  
  // For static QR, let's keep details clean and steady, matching the uploaded real QR structure
  const sub07 = getEmvTag('07', `Table #${tableStr}`)
  const t62 = getEmvTag('62', sub07)
  
  const partial = t00 + t01 + t38 + t52 + t53 + t58 + t59 + t60 + t62 + '6304'
  return partial + calculateCrc16(partial)
})

const getQrUrl = (data: string) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=0f172a&data=${encodeURIComponent(data)}`
}

const cartCount = computed(() => {
  return activeDisplayOrders.value.reduce((acc: number, item: any) => acc + item.quantity, 0)
})

const orderSubtotal = computed(() => {
  return myOrders.value.reduce((acc: number, item: any) => acc + (item.price * item.quantity), 0)
})

const orderTax = computed(() => {
  return +(orderSubtotal.value * 0.1).toFixed(2)
})

const orderServiceFee = computed(() => {
  return +(orderSubtotal.value * 0.05).toFixed(2)
})

const orderTotal = computed(() => {
  return +(orderSubtotal.value + orderTax.value + orderServiceFee.value).toFixed(2)
})

const updateOrdersStorage = () => {
  localStorage.setItem('gomeal_customer_orders', JSON.stringify(allOrders.value))
}

const removeOrder = (id: number) => {
  allOrders.value = allOrders.value.filter((o: any) => o.id !== id)
  updateOrdersStorage()
}

const incrementOrderQty = (id: number) => {
  const item = allOrders.value.find((o: any) => o.id === id)
  if (item) {
    item.quantity++
    updateOrdersStorage()
  }
}

const decrementOrderQty = (id: number) => {
  const item = allOrders.value.find((o: any) => o.id === id)
  if (item && item.quantity > 1) {
    item.quantity--
    updateOrdersStorage()
  } else if (item && item.quantity === 1) {
    removeOrder(id)
  }
}

const callWaiter = () => {
  orderSuccessMessage.value = `Waiter called to Table #${currentTable.value}! Assistance is on the way.`
  isOrderSuccessToastVisible.value = true
  setTimeout(() => {
    isOrderSuccessToastVisible.value = false
  }, 4000)
}

const requestBill = () => {
  if (myOrders.value.length === 0) {
    orderSuccessMessage.value = "Your current order list is empty. Add items first!"
    isOrderSuccessToastVisible.value = true
    setTimeout(() => {
      isOrderSuccessToastVisible.value = false
    }, 4000)
    return
  }
  // Initialize values
  billingAmount.value = orderTotal.value
  isPaymentQrModalOpen.value = true
  resetSimulationState()

  // Automatically attempt opening ABA App scan screen using deep link standard code
  setTimeout(() => {
    triggerAbaDeepLink()
  }, 4000)
}

const confirmPaymentRequest = () => {
  const totalAmount = billingAmount.value
  
  // Set all current table orders to Pending payment
  allOrders.value = allOrders.value.map((o: any) => {
    if (o.tableNo === currentTable.value) {
      return { ...o, paymentStatus: 'Pending' }
    }
    return o
  })
  
  updateOrdersStorage()
  isPaymentQrModalOpen.value = false
  isOrdersModalOpen.value = false
  orderSuccessMessage.value = `Receipt of $${totalAmount.toFixed(2)} requested! Cashier has been notified. Please settle payment.`
  isOrderSuccessToastVisible.value = true
  setTimeout(() => {
    isOrderSuccessToastVisible.value = false
  }, 6000)
}

const isOrderSuccessToastVisible = ref(false)
const orderSuccessMessage = ref('')

const checkoutProductDirectly = async (item: any, withCustomization: boolean = false) => {
  const qty = withCustomization ? personalizeQuantity.value : getItemQuantity(item.id)
  const total = item.price * qty
  let details = ''
  let customStr = 'Standard Portions'
  let customizedDetails: any[] = []
  
  if (withCustomization) {
    const changes = personalizedIngredients.value
      .filter(i => i.amount !== i.originalAmount)
      .map(i => `${i.name}: ${i.originalAmount} -> ${i.amount} ${i.unit}`)
    details = changes.length > 0 ? ` (Custom portions: ${changes.join(', ')})` : ' (Standard Portions)'
    customStr = changes.length > 0 ? changes.join(', ') : 'Standard Portions'
    
    customizedDetails = personalizedIngredients.value
      .filter(i => i.amount !== i.originalAmount)
      .map(i => ({
        name: i.name,
        originalAmount: i.originalAmount,
        amount: i.amount,
        unit: i.unit,
        diff: +(i.amount - i.originalAmount).toFixed(2),
        isIncrease: i.amount > i.originalAmount
      }))
  }
  
  // Send order to backend API
  try {
    const orderPayload = {
      tableId: currentTable.value,
      items: [
        {
          menuItemId: item.id || 1,
          quantity: qty,
          customizations: personalizedIngredients.value
            .filter(i => i.amount !== i.originalAmount)
            .map(i => ({
              ingredientId: 1,
              name: i.name,
              originalAmount: i.originalAmount,
              amount: i.amount,
              unit: i.unit,
              difference: +(i.amount - i.originalAmount).toFixed(2),
              isIncrease: i.amount > i.originalAmount
            })),
          customizationNote: customStr
        }
      ]
    }
    await orderService.createOrder(orderPayload)
  } catch (apiErr) {
    console.log('Order API dispatch notice:', apiErr)
  }

  // Try to find if the same item with same customizations is already ordered so we can consolidate
  const existingIndex = allOrders.value.findIndex((o: any) => o.name === item.name && o.customizations === customStr && o.status === 'Preparing' && o.tableNo === currentTable.value)
  if (existingIndex > -1) {
    allOrders.value[existingIndex].quantity += qty
    allOrders.value[existingIndex].customerName = guestName.value.trim() || `Guest at Table ${currentTable.value}`
    allOrders.value[existingIndex].paymentStatus = allOrders.value[existingIndex].paymentStatus || 'Unpaid'
  } else {
    allOrders.value.push({
      id: Date.now() + Math.floor(Math.random() * 1000),
      name: item.name,
      price: item.price,
      quantity: qty,
      image: item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400',
      status: 'Preparing',
      customizations: customStr,
      customizedDetails: customizedDetails,
      tableNo: currentTable.value,
      customerName: guestName.value.trim() || `Guest at Table ${currentTable.value}`,
      paymentStatus: 'Unpaid',
      timePlaced: 'Just now'
    })
  }
  updateOrdersStorage()
  
  if (currentLang.value === 'km') {
    const dishKM = translateDishName(item.name)
    orderSuccessMessage.value = `បានកុម្ម៉ង់ ${dishKM} ចំនួន x${qty} ($${total.toFixed(2)}) ដោយជោគជ័យ! បានបញ្ចូលទៅក្នុងបញ្ជីគ្រោងចម្អិនរបស់តុរួចរាល់។`
  } else {
    orderSuccessMessage.value = `Successfully ordered x${qty} ${item.name} ($${total.toFixed(2)})${details}! Added to table order list.`
  }
  isOrderSuccessToastVisible.value = true
  
  if (withCustomization) {
    isPersonalizeModalOpen.value = false
  } else {
    itemQuantities.value[item.id] = 1
  }
  
  setTimeout(() => {
    isOrderSuccessToastVisible.value = false
  }, 5000)
}

const checkoutComboDirectly = async () => {
  const comboItem = {
    id: 999123,
    name: 'Classic Burger + Fried Rice',
    price: 9.99,
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=200',
    status: 'Available'
  }
  
  const qty = 1

  try {
    await orderService.createOrder({
      tableId: currentTable.value,
      items: [
        {
          menuItemId: 1,
          quantity: qty,
          customizationNote: 'Standard Combo Deal'
        }
      ]
    })
  } catch (apiErr) {
    console.log('Combo API notice:', apiErr)
  }
  
  allOrders.value.push({
    id: Date.now() + Math.floor(Math.random() * 1000),
    name: comboItem.name,
    price: comboItem.price,
    quantity: qty,
    image: comboItem.image,
    status: 'Preparing',
    customizations: 'Standard Combo Deal',
    customizedDetails: [],
    tableNo: currentTable.value,
    customerName: guestName.value.trim() || `Guest at Table ${currentTable.value}`,
    paymentStatus: 'Unpaid',
    timePlaced: 'Just now'
  })
  
  updateOrdersStorage()
  
  if (currentLang.value === 'km') {
    orderSuccessMessage.value = `បានកុម្ម៉ង់ឈុត ប៊ឺហ្គឺរ + បាយឆាគ្រឿងសមុទ្រ ចំនួន x1 ($9.99) ដោយជោគជ័យ! បញ្ចូលទៅក្នុងបញ្ជីចម្អិនរបស់តុរួចរាល់។`
  } else {
    orderSuccessMessage.value = `Successfully ordered x1 Classic Burger + Fried Rice Combo ($9.99)! Added to table order list.`
  }
  isOrderSuccessToastVisible.value = true
  
  setTimeout(() => {
    isOrderSuccessToastVisible.value = false
  }, 5000)
}

const delayMessage = ref('')

const loadDelayMessages = () => {
  const tbl = currentTable.value
  const storedNotices = localStorage.getItem('gomeal_delay_messages')
  if (storedNotices) {
    try {
      const notices = JSON.parse(storedNotices)
      delayMessage.value = notices[tbl] || ''
    } catch (e) {
      console.error(e)
    }
  } else {
    delayMessage.value = ''
  }
}

const getOrderStatusLabel = (status: string) => {
  const s = status ? status.toLowerCase() : ''
  if (s === 'served') return t('cookingStatusServed')
  if (s === 'pending') return t('cookingStatusPending')
  if (s === 'preparing' || s === 'sent to kitchen') return t('cookingStatusPreparing')
  if (s === 'ready' || s === 'ready to serve') return t('cookingStatusReady')
  return status
}

const dismissDelayMessage = () => {
  const tbl = currentTable.value
  const storedNotices = localStorage.getItem('gomeal_delay_messages')
  if (storedNotices) {
    try {
      const notices = JSON.parse(storedNotices)
      delete notices[tbl]
      localStorage.setItem('gomeal_delay_messages', JSON.stringify(notices))
    } catch (e) {
      console.error(e)
    }
  }
  delayMessage.value = ''
  window.dispatchEvent(new Event('storage'))
}

const syncMenuData = () => {
  // Check route parameter for table number first
  if (route.params.tableId) {
    localStorage.setItem('gomeal_selected_table', String(route.params.tableId))
  } else {
    // Check URL query parameters for table number to allow scanning QR to set the table automatically
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tableQuery = urlParams.get('table')
      if (tableQuery) {
        localStorage.setItem('gomeal_selected_table', tableQuery)
      }
    } catch (e) {
      console.error('Error processing URL parameters:', e)
    }
  }

  // Set default guest name if none exists
  if (!localStorage.getItem('gomeal_customer_name')) {
    const tableId = route.params.tableId || localStorage.getItem('gomeal_selected_table') || '12B'
    localStorage.setItem('gomeal_customer_name', `Guest at Table ${tableId}`)
  }

  currentTable.value = localStorage.getItem('gomeal_selected_table') || '12B'
  guestName.value = localStorage.getItem('gomeal_customer_name') || ''
  loadOrders()
  loadDelayMessages()
  categories.value = loadCategoriesFromStorage()
  menuItems.value = loadMenuItems()
}

onMounted(async () => {
  syncMenuData()
  window.addEventListener('storage', syncMenuData)

  // Ensure Customer token is stored
  try {
    if (!getAccessToken()) {
      await login({ 
        role: 'Customer', 
        name: guestName.value || `Guest at Table ${currentTable.value}`, 
        tableId: currentTable.value 
      })
    }
  } catch (authErr) {
    console.log('Customer auth notice:', authErr)
  }

  // Load latest categories and menu items from backend API
  try {
    const catRes = await menuService.getCategories()
    if (catRes.data && Array.isArray(catRes.data) && catRes.data.length > 0) {
      const cats = catRes.data.map((c: any) => ({
        name: c.name,
        icon: c.icon || 'restaurant',
        active: c.name.toLowerCase() === activeCategory.value.toLowerCase()
      }))
      const hasAll = cats.some((c: any) => c.name.toLowerCase() === 'all menu')
      if (!hasAll) {
        cats.unshift({ name: 'All Menu', icon: 'grid_view', active: activeCategory.value.toLowerCase() === 'all menu' })
      }
      categories.value = cats
    }

    const itemsRes = await menuService.getMenuItems()
    if (itemsRes.data && Array.isArray(itemsRes.data) && itemsRes.data.length > 0) {
      menuItems.value = itemsRes.data.map((i: any) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        description: i.description || '',
        ingredients: (i.ingredients || []).map((ing: any) => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit
        })),
        status: i.status || 'Available',
        image: i.image
      }))
    }
  } catch (loadErr) {
    console.log('Backend menu data load notice:', loadErr)
  }

  // Real-Time Socket.IO connection and Table Room
  try {
    joinTableRoom(currentTable.value)
    const socket = getSocket()
    socket.on('notification.created', (notif: any) => {
      if (notif.tableId === currentTable.value || !notif.tableId) {
        delayMessage.value = notif.message
        const storedNotices = localStorage.getItem('gomeal_delay_messages') || '{}'
        try {
          const notices = JSON.parse(storedNotices)
          notices[currentTable.value] = notif.message
          localStorage.setItem('gomeal_delay_messages', JSON.stringify(notices))
        } catch (e) {}
      }
    })
    socket.on('order.status.updated', () => {
      syncMenuData()
    })
  } catch (socketErr) {
    console.log('Socket listener notice:', socketErr)
  }

  const interval = setInterval(syncMenuData, 2500)
  onUnmounted(() => {
    clearInterval(interval)
    window.removeEventListener('storage', syncMenuData)
  })
})
</script>

<template>
  <div class="bg-surface min-h-screen">
    <!-- Header -->
    <header class="fixed top-0 left-0 right-0 h-20 bg-white/90 backdrop-blur-md border-b border-surface-variant flex items-center justify-between px-6 sm:px-8 z-40 gap-4">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-black text-on-surface tracking-tight">TosEat.</h1>
        <span class="bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg shrink-0">
          {{ currentLang === 'km' ? 'តុលេខ #' + currentTable : 'Table #' + currentTable }}
        </span>
      </div>

      <div class="flex-1 max-w-md hidden sm:block">
        <div class="relative group">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">search</span>
          <input 
            type="text" 
            v-model="searchQuery"
            :placeholder="t('searchPlaceholder')"
            class="w-full bg-surface-container-low border-none rounded-full py-2.5 pl-12 pr-4 text-sm focus:ring-2 focus:ring-primary-container outline-none transition-all placeholder:text-outline/80"
          />
        </div>
      </div>

      <div class="flex items-center gap-3 shrink-0">
        <!-- Language Switcher -->
        <div class="flex items-center bg-slate-100 border border-slate-200/50 rounded-xl p-0.5">
          <button 
            @click="setLang('en')"
            type="button"
            :class="[
              'px-2.5 py-1 text-[11px] font-black rounded-lg transition-all',
              currentLang === 'en' ? 'bg-white text-primary shadow-2xs border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            EN
          </button>
          <button 
            @click="setLang('km')"
            type="button"
            :class="[
              'px-2.5 py-1 text-[11px] font-black rounded-lg transition-all',
              currentLang === 'km' ? 'bg-white text-primary shadow-2xs border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'
            ]"
          >
            ខ្មែរ
          </button>
        </div>

        <router-link to="/" class="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-secondary hover:text-primary hover:bg-primary/5 transition-all text-xs sm:text-sm font-bold">
          <span class="material-symbols-outlined text-base">logout</span>
          <span>{{ t('switchTable') }}</span>
        </router-link>
      </div>
    </header>

    <!-- Mobile Search Bar (under the header on small screens) -->
    <div class="p-4 sm:hidden bg-white/95 border-b border-surface-variant fixed top-20 left-0 right-0 z-30 flex gap-2">
      <div class="relative group flex-1">
        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
        <input 
          type="text" 
          v-model="searchQuery"
          :placeholder="t('searchPlaceholder')"
          class="w-full bg-surface-container-low border-none rounded-full py-2 pl-10 pr-4 text-xs focus:ring-2 focus:ring-primary-container outline-none"
        />
      </div>
    </div>

    <!-- Main Content -->
    <main class="pt-24 sm:pt-24 pb-16 px-4 sm:px-8 w-full max-w-7xl mx-auto space-y-10" :class="{ 'mt-14': searchQuery || searchQuery === '' }">
      <!-- Welcome Section -->
      <section class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span class="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase">{{ t('table') }} #{{ currentTable }}</span>
          <h2 class="text-4xl font-black text-on-surface mt-2">{{ t('welcomeBack') }}, {{ guestName || (currentLang === 'km' ? 'ភ្ញៀវសកម្ម' : 'Guest') }}!</h2>
          <p class="text-on-surface-variant max-w-md mt-1">{{ t('freshSelections') }} <span class="block mt-1 font-semibold text-xs text-primary">{{ t('kitchenTime') }} 15-20 {{ t('mins') }}</span></p>
        </div>
      </section>

      <!-- Delay notice / Kitchen Notification banner -->
      <div 
        v-if="delayMessage" 
        :class="[
          'border-2 p-5 rounded-3xl flex items-start gap-4 shadow-sm transition-all',
          (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
            ? 'bg-emerald-50 border-emerald-300' 
            : 'bg-amber-50 border-amber-300 animate-pulse'
        ]"
      >
        <span 
          :class="[
            'material-symbols-outlined text-[28px] p-2.5 rounded-2xl shrink-0 font-black',
            (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
              ? 'text-emerald-700 bg-emerald-100'
              : 'text-amber-700 bg-amber-100'
          ]"
        >
          {{ (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់')) ? 'check_circle' : 'schedule' }}
        </span>
        <div class="flex-1 border-0">
          <div class="flex items-center justify-between">
            <h4 
              :class="[
                'text-xs font-black uppercase tracking-widest',
                (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
                  ? 'text-emerald-800'
                  : 'text-amber-800'
              ]"
            >
              {{ 
                (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
                  ? (currentLang === 'km' ? '🎉 អាហាររួចរាល់ហើយ' : '🎉 Food is Ready!')
                  : (currentLang === 'km' ? '⚠️ ដំណឹងពីចង្ក្រានបាយ' : '⚠️ Kitchen Notification')
              }}
            </h4>
            <button 
              @click="dismissDelayMessage" 
              :class="[
                'font-black text-xs uppercase tracking-wider px-3 py-1 rounded-full cursor-pointer transition-all border-0 outline-none',
                (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
                  ? 'text-emerald-800 bg-emerald-150 hover:bg-emerald-250'
                  : 'text-amber-800 bg-amber-150 hover:bg-amber-250'
              ]"
            >
              {{ currentLang === 'km' ? 'យល់ព្រម' : 'Got it' }}
            </button>
          </div>
          <p 
            :class="[
              'text-sm font-black mt-1.5 leading-relaxed',
              (delayMessage.includes('cook') || delayMessage.includes('ready') || delayMessage.includes('done') || delayMessage.includes('ចម្អិនរួចរាល់'))
                ? 'text-emerald-950'
                : 'text-amber-950'
            ]"
          >
            {{ delayMessage }}
          </p>
        </div>
      </div>

      <!-- Category Section -->
      <section>
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'ជម្រើសមុខម្ហូប' : 'Category' }}</h3>
        </div>
        <div class="grid grid-cols-3 sm:grid-cols-7 gap-4">
          <div 
            v-for="cat in categories" 
            :key="cat.name"
            @click="selectCategory(cat.name)"
            class="bg-white p-4 rounded-2xl shadow-sm border-2 transition-all cursor-pointer flex flex-col items-center gap-3"
            :class="cat.active ? 'border-primary-container bg-primary-fixed/30 shadow-md scale-[1.02]' : 'border-transparent hover:border-surface-variant hover:shadow-xs'"
          >
            <div 
              class="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              :class="cat.active ? 'bg-primary text-white' : 'bg-surface-container-low text-primary'"
            >
              <span class="material-symbols-outlined text-[28px]">{{ cat.icon }}</span>
            </div>
            <span class="text-xs font-black text-on-surface-variant uppercase tracking-wider text-center">{{ getCategoryDisplayName(cat.name) }}</span>
          </div>
        </div>
      </section>

      <!-- Popular Products -->
      <section>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'មុខម្ហូបប្រចាំហាង' : 'Live Menu Selection' }}</h3>
          <span class="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">{{ currentLang === 'km' ? 'តម្រង' : 'Filtered' }}: {{ getCategoryDisplayName(activeCategory) }}</span>
        </div>
        <div v-if="filteredMenuItems.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div 
            v-for="prod in filteredMenuItems" 
            :key="prod.id"
            class="bg-white p-5 rounded-3xl shadow-sm hover:shadow-xl border transition-all duration-300 group flex flex-col relative"
            :class="[
              prod.status === 'Sold Out' ? 'opacity-75 grayscale-[0.1] border-outline-variant/40' : 'border-surface-variant hover:border-primary-container'
            ]"
          >
            <div class="relative overflow-hidden rounded-2xl mb-4 h-44 bg-surface-container-lowest">
              <img :src="prod.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400'" :alt="prod.name" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
              <button class="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur-md rounded-full text-on-surface-variant hover:text-secondary transition-colors shadow-sm">
                <span class="material-symbols-outlined text-[20px]">favorite</span>
              </button>
              <div class="absolute bottom-3 left-3 flex flex-col gap-1 items-start">
                <span 
                  class="px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm"
                  :class="prod.status === 'Available' ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-secondary-container text-on-secondary-container'"
                >
                  {{ prod.status === 'Available' ? t('available') : t('soldOut') }}
                </span>
                <span v-if="prod.lowStock" class="bg-secondary text-white px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm">{{ currentLang === 'km' ? 'គ្រឿងផ្សំតិច' : 'Low Stock' }}</span>
              </div>
            </div>

            <div class="flex justify-between items-start mb-2">
              <div class="truncate mr-2">
                <h4 class="font-black text-on-surface text-base truncate">{{ translateDishName(prod.name) }}</h4>
                <div class="flex items-center gap-1 text-primary-container mt-1">
                  <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1">star</span>
                  <span class="text-on-surface-variant text-[11px] font-bold">4.9 <span class="font-medium opacity-50">({{ currentLang === 'km' ? 'លក់ដាច់ខ្លាំង' : '120+ Ordered' }})</span></span>
                </div>
              </div>
              <div class="text-right flex flex-col shrink-0">
                <span class="text-primary font-black text-lg">${{ (prod.price * (prod.status === 'Available' ? getItemQuantity(prod.id) : 1)).toFixed(2) }}</span>
                <span v-if="prod.status === 'Available' && getItemQuantity(prod.id) > 1" class="text-[9px] text-outline font-black">${{ prod.price.toFixed(2) }} {{ currentLang === 'km' ? 'ក្នុងមួយឯកតា' : 'each' }}</span>
              </div>
            </div>

            <p class="text-on-surface-variant text-[11px] line-clamp-2 mb-4 leading-relaxed font-medium">{{ translateDishDesc(prod.name, prod.description) }}</p>
            
            <!-- Ingredients Quick Tags -->
            <div v-if="prod.ingredients && prod.ingredients.length > 0" class="flex flex-wrap gap-1 mb-4">
              <span 
                v-for="(ing, idx) in prod.ingredients.slice(0, 3)" 
                :key="idx" 
                class="px-2 py-0.5 bg-surface-container rounded text-[9px] font-bold text-on-surface-variant border border-outline-variant/35"
              >
                {{ translateIngredient(ing.name) }} ({{ ing.amount }}{{ ing.unit }})
              </span>
              <span v-if="prod.ingredients.length > 3" class="text-[9px] font-bold text-outline py-0.5">+{{ prod.ingredients.length - 3 }} {{ currentLang === 'km' ? 'ផ្សេងទៀត' : 'more' }}</span>
            </div>

            <!-- Dynamic Customer Quantity Selector & Text Input -->
            <div v-if="prod.status === 'Available'" class="flex items-center justify-between mb-4 bg-surface-container-low px-3 py-2 rounded-2xl border border-outline-variant/20 shadow-inner">
              <span class="text-[10px] font-black uppercase text-outline tracking-widest">{{ currentLang === 'km' ? 'បរិមាណ' : 'Order Quantity' }}</span>
              <div class="flex items-center gap-2">
                <button 
                  type="button" 
                  @click="decrementItemQuantity(prod.id)"
                  class="w-7 h-7 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant rounded-lg font-bold transition-all shadow-sm active:scale-95 animate-none"
                >
                  <span class="material-symbols-outlined text-[12px] font-black">remove</span>
                </button>
                <input 
                  type="number" 
                  min="1"
                  step="1"
                  :value="getItemQuantity(prod.id)"
                  @input="(el) => {
                    const val = parseInt((el.target as HTMLInputElement).value);
                    itemQuantities[prod.id] = (isNaN(val) || val < 1) ? 1 : val;
                  }"
                  class="w-12 text-center bg-white border border-outline-variant/40 rounded-lg p-1 font-black text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-sm"
                />
                <button 
                  type="button" 
                  @click="incrementItemQuantity(prod.id)"
                  class="w-7 h-7 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant rounded-lg font-bold transition-all shadow-sm active:scale-95 animate-none"
                >
                  <span class="material-symbols-outlined text-[12px] font-black">add</span>
                </button>
              </div>
            </div>

            <div class="mt-auto flex items-center justify-between pt-2 border-t border-surface-variant/30">
              <div class="flex items-center gap-1 text-on-surface-variant text-[11px] font-semibold">
                <span class="material-symbols-outlined text-[16px]">schedule</span>
                15-20{{ t('mins') }}
              </div>
              <div class="flex items-center gap-2">
                <!-- If available, personalize and order -->
                <button 
                  v-if="prod.status === 'Available'"
                  @click="openPersonalize(prod)"
                  class="text-primary font-black text-xs hover:bg-primary/5 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  {{ currentLang === 'km' ? 'កែសម្រួល' : 'Personalize' }}
                </button>
                <button 
                  v-if="prod.status === 'Available'"
                  @click="checkoutProductDirectly(prod, false)"
                  class="bg-primary hover:opacity-90 active:scale-95 text-white px-4 py-1.5 rounded-full font-black text-xs transition-all shadow-md shadow-primary/10"
                >
                  {{ currentLang === 'km' ? 'កុម្ម៉ង់' : 'Order' }}
                </button>
                
                <!-- If sold out, show deactivated status badge -->
                <span v-else class="text-[11px] font-black text-outline uppercase tracking-wider py-1.5 px-3 bg-surface-container-high rounded-full">{{ t('soldOut') }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="text-center py-12 bg-white rounded-3xl border border-dashed border-outline-variant">
          <span class="material-symbols-outlined text-outline text-5xl mb-3">restaurant</span>
          <p class="text-sm font-black text-on-surface-variant">{{ currentLang === 'km' ? 'មិនមានមុខម្ហូបក្នុងក្រុមនេះមែនទេ' : 'No items match' }} "{{ getCategoryDisplayName(activeCategory) }}"</p>
          <p class="text-xs text-outline font-bold mt-1">{{ currentLang === 'km' ? 'សូមជ្រើសរើសជម្រើសផ្សេងទៀត' : 'Check our categories above.' }}</p>
        </div>
      </section>

      <!-- Best Sellers -->
      <section>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'មុខម្ហូបលក់ដាច់បំផុត' : 'Best Seller' }}</h3>
          <button class="text-primary text-xs font-bold flex items-center">{{ currentLang === 'km' ? 'មើលទាំងអស់' : 'View all' }} <span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
        </div>
        <div class="flex gap-4 overflow-x-auto pb-6 no-scrollbar snap-x">
          <div 
            v-for="item in bestSellers" 
            :key="item.name"
            class="min-w-[170px] bg-white rounded-3xl p-5 shadow-sm snap-start text-center border border-surface-variant hover:border-primary-container transition-all group"
          >
            <div class="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden p-1 border-2 border-surface-container group-hover:border-primary-container transition-colors">
              <img :src="item.image" :alt="item.name" class="w-full h-full object-cover rounded-full" />
            </div>
            <h5 class="font-black text-sm mb-1 line-clamp-1">{{ translateDishName(item.name) }}</h5>
            <p class="text-primary font-black text-sm mb-4">${{ item.price.toFixed(2) }}</p>
            <div class="flex items-center justify-center gap-1 text-tertiary font-bold text-[10px] bg-tertiary/10 py-1.5 rounded-full px-3">
              <span>{{ currentLang === 'km' ? 'លក់បាន ' : 'Sold ' }}{{ item.sold }}</span>
              <span class="material-symbols-outlined text-[14px]">trending_up</span>
              <span>{{ item.growth }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Promo Section -->
      <section>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'ប្រម៉ូសិនពិសេស' : 'Promo' }}</h3>
          <button class="text-primary text-xs font-bold flex items-center">{{ currentLang === 'km' ? 'មើលទាំងអស់' : 'View all' }} <span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="bg-white p-4 rounded-3xl shadow-sm border border-surface-variant flex gap-4 items-center group hover:border-primary-container transition-all">
            <div class="relative w-24 h-24 shrink-0 overflow-hidden rounded-2xl bg-surface-container">
              <span class="absolute top-0 left-0 bg-secondary text-white px-2 py-0.5 rounded-br-lg text-[10px] font-black z-10">{{ currentLang === 'km' ? 'ចុះសល់ ' : '' }}15% Off</span>
              <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src="https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=400" />
            </div>
            <div class="flex flex-col gap-1">
              <h6 class="font-black text-sm line-clamp-1">{{ translateDishName('Cheese Burger') }}</h6>
              <div class="flex items-center gap-2">
                <span class="text-primary font-black">$3.59</span>
                <span class="text-on-surface-variant/50 text-[10px] line-through">$5.59</span>
              </div>
              <div class="flex items-center gap-1 text-primary-container">
                <span class="material-symbols-outlined text-[12px]" style="font-variation-settings: 'FILL' 1">star</span>
                <span class="text-on-surface-variant text-[10px] font-bold">5.0 <span class="opacity-50">({{ currentLang === 'km' ? 'ការវាយតម្លៃ ១ពាន់+' : '1k+ Reviews' }})</span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Popular Pairings -->
      <section>
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-xl font-black text-on-surface">{{ currentLang === 'km' ? 'ឈុតចាប់គូពេញនិយម' : 'Popular Pairings' }}</h3>
          <button class="text-primary text-xs font-bold flex items-center">{{ currentLang === 'km' ? 'មើលទាំងអស់' : 'View all' }} <span class="material-symbols-outlined text-[16px]">chevron_right</span></button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div v-for="i in 3" :key="i" class="bg-white p-6 rounded-3xl shadow-sm hover:shadow-md transition-all border border-surface-variant flex flex-col group">
            <div class="flex items-center justify-center gap-2 mb-6">
              <div class="w-24 h-24 rounded-full overflow-hidden border-2 border-surface-container-low group-hover:border-primary-container transition-colors">
                <img class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=200" />
              </div>
              <span class="material-symbols-outlined text-outline">add</span>
              <div class="w-24 h-24 rounded-full overflow-hidden border-2 border-surface-container-low group-hover:border-primary-container transition-colors">
                <img class="w-full h-full object-cover" src="https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=200" />
              </div>
            </div>
            <div class="text-center mb-6">
              <h4 class="text-lg font-black text-on-surface">{{ currentLang === 'km' ? 'ឈុតប៊ឺហ្គឺរ + បាយឆាគ្រឿងសមុទ្រ' : 'Classic Burger + Fried Rice' }}</h4>
              <div v-if="i === 1" class="mt-1 bg-tertiary/10 text-tertiary text-[10px] inline-block px-2 py-0.5 rounded-full font-black">{{ currentLang === 'km' ? 'លក់ដាច់បំផុត' : 'Most Popular' }}</div>
              <p class="text-on-surface-variant text-xs mt-1">{{ currentLang === 'km' ? 'ឈុតអាហារសម្រន់ឆ្ងាញ់ពិសាសម្រាប់ញ៉ាំគ្នាពីរនាក់' : 'The ultimate hunger-crusher combo for two.' }}</p>
            </div>
            <div class="mt-auto flex items-center justify-between border-t border-surface-variant pt-4">
              <div class="flex flex-col">
                <span class="text-secondary font-black text-xs uppercase tracking-tighter">{{ currentLang === 'km' ? 'តម្លៃឈុតរួមគ្នា' : 'Combo Price' }}</span>
                <span class="text-primary font-black text-xl">$9.99</span>
              </div>
              <button 
                @click="checkoutComboDirectly"
                class="bg-primary text-white px-6 py-2.5 rounded-full font-black text-xs hover:opacity-90 active:scale-95 transition-all"
              >
                {{ currentLang === 'km' ? 'កុម្ម៉ង់ឈុតនេះ' : 'Add Pair' }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Contextual FAB (Cart) -->
    <button @click="isOrdersModalOpen = true" class="fixed bottom-8 right-8 bg-primary text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-black hover:scale-105 active:scale-95 transition-all z-50">
      <span class="material-symbols-outlined text-[28px]">shopping_bag</span>
      <span>{{ currentLang === 'km' ? 'កន្ត្រកតុ ' + currentTable + ' (' + cartCount + ')' : 'My Order (' + cartCount + ')' }}</span>
    </button>

    <!-- CUSTOMER INGREDIENT PERSONALIZATION DIALOG -->
    <div 
      v-if="isPersonalizeModalOpen && personalizingItem"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
    >
      <div 
        class="bg-white rounded-[32px] max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-surface-variant/40 animate-in fade-in zoom-in-95 duration-200"
      >
        <!-- Modal Head with Image background/accent -->
        <div class="relative bg-surface-container p-6 border-b border-surface-variant/40 shrink-0">
          <div class="flex gap-4 items-center">
            <div class="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-outline-variant/30">
              <img :src="personalizingItem.image" :alt="personalizingItem.name" class="w-full h-full object-cover" />
            </div>
            <div>
              <span class="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-2.5 py-1 rounded-full">{{ currentLang === 'km' ? 'កែសម្រួលគ្រឿងផ្សំពិសេស' : 'Custom Personalizer' }}</span>
              <h3 class="text-xl font-black text-on-surface mt-1">{{ translateDishName(personalizingItem.name) }}</h3>
              <p class="text-xs text-on-surface-variant font-bold mt-0.5">${{ personalizingItem.price.toFixed(2) }} ({{ currentLang === 'km' ? 'តម្លៃដើម' : 'base price' }})</p>
            </div>
          </div>
          <button 
            @click="isPersonalizeModalOpen = false"
            class="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Scrollable Ingredients Adjustments list -->
        <div class="p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div>
            <h4 class="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-1">{{ currentLang === 'km' ? 'បន្ថែម/បន្ថយកម្រិតគ្រឿងផ្សំ' : 'Portion Customizer' }}</h4>
            <p class="text-[11px] text-outline font-medium leading-relaxed">{{ currentLang === 'km' ? 'អ្នកអាចបន្ថែមឬបន្ថយបរិមាណគ្រឿងផ្សំបានសេរី គ្រឿងផ្សំនឹងត្រូវរៀបចំដោយផ្ទាល់ដោយចុងភៅរបស់យើង។' : 'Adjust individual quantities below. Decreasing an ingredient below standard size will reduce its texture, while increasing will add extra flavor.' }}</p>
          </div>

          <div v-if="personalizedIngredients.length > 0" class="space-y-3.5">
            <div 
              v-for="(ing, idx) in personalizedIngredients" 
              :key="idx"
              class="flex items-center justify-between p-4 bg-surface-container rounded-2xl border border-outline-variant/35 group hover:border-primary/20 transition-colors"
            >
              <div>
                <p class="text-sm font-black text-on-surface">{{ translateIngredient(ing.name) }}</p>
                <!-- Display standard portion hint if modified -->
                <div class="flex items-center gap-1.5 mt-1">
                  <span class="text-[10px] font-black uppercase tracking-wider text-outline px-1.5 py-0.5 bg-white rounded border border-outline-variant/50">
                    {{ currentLang === 'km' ? 'ទំហំ' : 'Size' }}: {{ ing.amount }} {{ ing.unit }}
                  </span>
                  <span 
                    v-if="ing.amount !== ing.originalAmount" 
                    class="text-[9px] font-black text-primary px-1.5 py-0.5 bg-primary/10 rounded-full"
                  >
                    {{ currentLang === 'km' ? 'បានកែច្នៃ' : 'Customized' }} ({{ currentLang === 'km' ? 'ស្តង់ដារ' : 'Std' }}: {{ ing.originalAmount }}{{ ing.unit }})
                  </span>
                </div>
              </div>

              <!-- Stepper button logic -->
              <div class="flex items-center gap-2">
                <button 
                  @click="adjustCustomerIngredient(idx, false)"
                  class="w-10 h-10 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant text-on-surface rounded-xl font-bold transition-all shadow-sm active:scale-95"
                  title="Reduce portion"
                >
                  <span class="material-symbols-outlined text-sm">remove</span>
                </button>
                
                <span class="w-16 text-center font-black text-sm text-on-surface select-none">
                  {{ ing.amount }} <span class="text-[10px] font-black text-outline uppercase">{{ ing.unit }}</span>
                </span>

                <button 
                  @click="adjustCustomerIngredient(idx, true)"
                  class="w-10 h-10 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant text-on-surface rounded-xl font-bold transition-all shadow-sm active:scale-95"
                  title="Increase portion"
                >
                  <span class="material-symbols-outlined text-sm">add</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else class="text-center py-8">
            <p class="text-xs text-outline font-bold">{{ t('noItemCustomizable') }}</p>
          </div>
        </div>

        <!-- Sticky Footer -->
        <div class="p-6 bg-surface-container border-t border-surface-variant/40 shrink-0 space-y-4">
          <!-- Overall Item Quantity in Modal -->
          <div class="flex items-center justify-between bg-white px-4 py-3 rounded-2xl border border-outline-variant/30 shadow-xs">
            <div class="flex flex-col">
              <span class="text-[10px] font-black uppercase text-outline tracking-wider">{{ currentLang === 'km' ? 'បរិមាណសរុប' : 'Overall Quantity' }}</span>
              <span class="text-xs font-bold text-on-surface-variant mt-0.5">
                {{ currentLang === 'km' ? 'សរុបជាបណ្ដោះអាសន្ន' : 'Subtotal' }}: <span class="text-primary font-black">${{ (personalizingItem.price * personalizeQuantity).toFixed(2) }}</span>
              </span>
            </div>
            
            <div class="flex items-center gap-2">
              <button 
                type="button" 
                @click="personalizeQuantity = Math.max(1, personalizeQuantity - 1)"
                class="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-primary hover:text-white rounded-lg font-bold transition-all shadow-sm active:scale-95 text-on-surface"
                title="Decrease overall quantity"
              >
                <span class="material-symbols-outlined text-sm font-black">remove</span>
              </button>
              
              <input 
                type="number" 
                min="1"
                step="1"
                :value="personalizeQuantity"
                @input="(el) => {
                  const val = parseInt((el.target as HTMLInputElement).value);
                  personalizeQuantity = (isNaN(val) || val < 1) ? 1 : val;
                }"
                class="w-12 text-center bg-white border border-outline-variant/40 rounded-lg py-1 px-2 font-black text-xs text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
              />
              
              <button 
                type="button" 
                @click="personalizeQuantity++"
                class="w-8 h-8 flex items-center justify-center bg-surface-container hover:bg-primary hover:text-white rounded-lg font-bold transition-all shadow-sm active:scale-95 text-on-surface"
                title="Increase overall quantity"
              >
                <span class="material-symbols-outlined text-sm font-black">add</span>
              </button>
            </div>
          </div>

          <div class="flex gap-4">
            <button 
              @click="isPersonalizeModalOpen = false"
              class="flex-1 bg-white border border-outline hover:bg-surface-container text-on-surface py-3 rounded-2xl font-black text-xs transition-colors"
            >
              {{ currentLang === 'km' ? 'បោះបង់' : 'Cancel Selection' }}
            </button>
            <button 
              @click="checkoutProductDirectly(personalizingItem, true)"
              class="flex-1 bg-primary text-white py-3 rounded-2xl font-black text-xs shadow-lg shadow-primary/20 hover:opacity-95 active:scale-95 transition-all text-center"
            >
              {{ currentLang === 'km' ? 'យល់ព្រម និងកុម្ម៉ង់ឥឡូវនេះ' : 'Apply & Order Now' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CUSTOMER ACTIVE ORDERS DIALOG -->
    <div 
      v-if="isOrdersModalOpen"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all duration-300"
    >
      <div 
        class="bg-white rounded-[32px] max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh] shadow-2xl border border-surface-variant/40 animate-in fade-in zoom-in-95 duration-200"
      >
        <!-- Modal Head -->
        <div class="relative bg-surface-container p-6 border-b border-surface-variant/40 shrink-0">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-primary text-3xl">receipt_long</span>
            <div>
              <span class="text-[10px] font-black uppercase text-primary tracking-widest bg-primary/10 px-2.5 py-1 rounded-full">{{ currentLang === 'km' ? 'ព័ត៌មានកុម្ម៉ង់ តុលេខ #' + currentTable : 'Table #' + currentTable + ' Order Status' }}</span>
              <h3 class="text-xl font-black text-on-surface mt-1">{{ currentLang === 'km' ? 'មុខម្ហូបដែលបានកុម្ម៉ង់សកម្ម' : 'My Active Orders' }}</h3>
            </div>
          </div>
          <button 
            @click="isOrdersModalOpen = false"
            class="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-all shadow-sm"
          >
            <span class="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <!-- Scrollable Active Orders List -->
        <div class="p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
          <!-- Pending Bill Status Alert Banner -->
          <div v-if="myOrders.some((o: any) => o.paymentStatus === 'Pending')" class="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 flex gap-3 items-start animate-pulse">
            <span class="material-symbols-outlined text-amber-700 shrink-0 mt-0.5">hourglass_empty</span>
            <div class="text-xs font-semibold">
              <p class="font-black text-amber-950">{{ currentLang === 'km' ? 'បានផ្ញើសំណើទូទាត់រួចរាល់!' : 'Receipt / Bill Requested!' }}</p>
              <p class="text-[11px] text-amber-800/90 mt-1 leading-relaxed">
                {{ currentLang === 'km' ? 'ប្រព័ន្ធបេឡាករទទួលបានព័ត៌មានរួចរាល់ហើយ។ សូមបន្តទៅកាន់ការទូទាត់ប្រាក់សរុបចំនួន' : 'The Cashier terminal has been notified. Please settle the total of' }} 
                <strong class="text-amber-950">${{ orderTotal.toFixed(2) }}</strong> 
                {{ currentLang === 'km' ? 'នៅបញ្ជរគិតលុយ។' : 'at the counter.' }}
              </p>
            </div>
          </div>

          <div v-if="activeDisplayOrders.length > 0" class="space-y-3.5">
            <div 
              v-for="order in activeDisplayOrders" 
              :key="order.id"
              class="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 gap-4"
            >
              <div class="flex gap-4 items-center">
                <div class="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-outline-variant/30">
                  <img :src="order.image" :alt="order.name" class="w-full h-full object-cover" />
                </div>
                <div class="min-w-0 flex-1">
                  <h4 class="font-black text-sm text-on-surface truncate">{{ translateDishName(order.name) }}</h4>
                  <p class="text-[11px] text-primary font-black mt-0.5">${{ order.price.toFixed(2) }} {{ currentLang === 'km' ? 'ក្នុងមួយមុខ' : 'each' }}</p>
                  <!-- Customizations display -->
                  <div class="text-[10px] text-on-surface-variant/80 font-bold bg-white px-2 py-0.5 rounded border border-outline-variant/40 mt-1 inline-flex items-center gap-1 max-w-full">
                    <span class="material-symbols-outlined text-[10px] text-outline shrink-0">tune</span>
                    <span class="truncate">{{ order.customizations }}</span>
                  </div>
                </div>
              </div>

              <!-- Stepper and Status Badges -->
              <div class="flex items-center justify-between sm:justify-start gap-4">
                <div class="flex items-center gap-2">
                  <button 
                    @click="decrementOrderQty(order.id)"
                    class="w-7 h-7 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant rounded-lg font-bold transition-all shadow-sm active:scale-95"
                    title="Decrease quantity"
                  >
                    <span class="material-symbols-outlined text-[12px] font-black">remove</span>
                  </button>
                  <span class="w-8 text-center font-black text-xs text-on-surface">
                    {{ order.quantity }}
                  </span>
                  <button 
                    @click="incrementOrderQty(order.id)"
                    class="w-7 h-7 flex items-center justify-center bg-white hover:bg-primary hover:text-white border border-outline-variant rounded-lg font-bold transition-all shadow-sm active:scale-95"
                    title="Increase quantity"
                  >
                    <span class="material-symbols-outlined text-[12px] font-black">add</span>
                  </button>
                </div>

                <div class="flex flex-col items-end shrink-0 gap-1.5 min-w-[70px]">
                  <span class="text-xs font-black text-on-surface">${{ (order.price * order.quantity).toFixed(2) }}</span>
                  <span 
                    class="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-xs flex items-center gap-1"
                    :class="[
                      order.status === 'Served' ? 'bg-emerald-100 text-emerald-800' : 
                      order.status === 'Sent to Kitchen' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                    ]"
                  >
                    <span class="w-1 h-1 rounded-full bg-current animate-pulse"></span>
                    {{ getOrderStatusLabel(order.status) }}
                  </span>
                </div>

                <button 
                  @click="removeOrder(order.id)"
                  class="w-8 h-8 flex items-center justify-center text-outline hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                  title="Cancel item"
                >
                  <span class="material-symbols-outlined text-lg">delete</span>
                </button>
              </div>
            </div>
          </div>
          <div v-else-if="myOrders.length > 0" class="text-center py-12 bg-emerald-50/50 rounded-[28px] border border-dashed border-emerald-200/60 p-6 flex flex-col items-center justify-center">
            <span class="material-symbols-outlined text-emerald-600 text-5xl mb-3">check_circle</span>
            <p class="text-sm font-black text-emerald-950 font-display">
              {{ currentLang === 'km' ? 'មុខម្ហូបទាំងអស់ត្រូវបានបម្រើជូនរួចរាល់!' : 'All items have been served!' }}
            </p>
            <p class="text-[11px] text-emerald-800 font-semibold mt-1.5 leading-relaxed max-w-md">
              {{ currentLang === 'km' ? 'លោកអ្នកអាចពិនិត្យកម្រងតម្លៃសរុប និងស្នើសុំការទូទាត់ប្រាក់នៅផ្នែកខាងក្រោម។ សូមអរគុណ!' : 'All your ordered dishes have been delivered to your table. Check your checkout summary and request the bill below. Thank you!' }}
            </p>
          </div>
          <div v-else class="text-center py-12 bg-surface-container rounded-[24px] border border-dashed border-outline-variant">
            <span class="material-symbols-outlined text-outline text-5xl mb-3">shopping_basket</span>
            <p class="text-sm font-black text-on-surface-variant">{{ t('emptyCartMessage') }}</p>
          </div>
        </div>

        <!-- Sticky Billing Footer -->
        <div class="p-6 bg-surface-container border-t border-surface-variant/40 shrink-0 space-y-4">
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs text-on-surface-variant font-bold">
              <span>{{ t('subtotal') }}</span>
              <span class="font-black text-on-surface">${{ orderSubtotal.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-on-surface-variant font-bold">
              <span>{{ t('taxAndFees') }}</span>
              <span class="font-black text-on-surface">${{ orderTax.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between text-xs text-on-surface-variant font-bold">
              <span>{{ t('serviceCharge') }}</span>
              <span class="font-black text-on-surface">${{ orderServiceFee.toFixed(2) }}</span>
            </div>
            <div class="flex items-center justify-between pt-2 border-t border-outline-variant/30">
              <span class="text-sm font-black text-on-surface">{{ t('grandTotal') }}</span>
              <span class="text-lg font-black text-primary">${{ orderTotal.toFixed(2) }}</span>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row gap-3">
            <button 
              @click="callWaiter"
              class="flex-1 bg-white border border-outline hover:bg-surface-container-low text-on-surface py-3.5 rounded-2xl font-black text-xs transition-colors flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined text-base">support_agent</span>
              {{ t('callWaiter') }}
            </button>
            <button 
              @click="requestBill"
              class="flex-1 bg-primary text-white py-3.5 rounded-2xl font-black text-xs shadow-lg shadow-primary/20 hover:opacity-95 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
            >
              <span class="material-symbols-outlined text-base">payments</span>
              {{ t('settleBillBtn') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CUSTOMER PAYMENT QR DIALOG -->
    <div 
      v-if="isPaymentQrModalOpen"
      class="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300 animate-in fade-in duration-300 pointer-events-auto"
    >
      <!-- Mode 1: Interactive ABA Mobile App Sandbox Simulator -->
      <div 
        v-if="isAbaSimulatorOpen" 
        class="bg-[#002e48] text-white rounded-[32px] max-w-sm w-full max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-teal-500/20 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto"
      >
        <!-- ABA STATUS BAR -->
        <div class="px-5 pt-3.5 pb-2 flex justify-between items-center text-[10px] font-bold text-[#1ebbc4] bg-[#001f33] shrink-0 border-b border-[#002a45]">
          <span class="flex items-center gap-1">
            <span class="material-symbols-outlined text-[10px] text-teal-400">shield</span>
            ABA' Mobile Pay • Sandbox
          </span>
          <div class="flex items-center gap-1 bg-teal-950/40 px-2 py-0.5 rounded-full">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="text-emerald-400 font-extrabold uppercase text-[8px] tracking-wide">Secured Link</span>
          </div>
        </div>

        <!-- ABA APP HEADER -->
        <div class="p-5 border-b border-white/5 shrink-0 text-center relative bg-[#001f33]">
          <!-- ABA Crown Circular Logo -->
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-400/10 border border-teal-400/20 mb-2 shadow-inner">
            <span class="material-symbols-outlined text-teal-400 text-2xl animate-pulse">account_balance</span>
          </div>
          <h3 class="text-base font-black tracking-tight text-white flex items-center justify-center gap-1.5">
            <span>ABA PAY Checkout</span>
            <span class="text-[9px] bg-[#1ebbc4] text-[#001e30] px-1.5 py-0.5 rounded font-black uppercase">Live Sim</span>
          </h3>
          <p class="text-[10px] text-slate-300 font-medium mt-1 uppercase tracking-widest">
            {{ currentLang === 'km' ? 'ប្រព័ន្ធបញ្ជាក់ការទូទាត់រហ័ស' : 'Instant Checkout Settlement' }}
          </p>
          <button 
            @click="resetSimulationState"
            class="absolute top-4 right-4 p-1.5 bg-white/5 hover:bg-white/10 rounded-full text-slate-300 hover:text-white transition-all outline-none border-none cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <!-- Content Area -->
        <div class="p-5 flex-1 overflow-y-auto min-h-0 flex flex-col bg-[#001d2e] custom-scrollbar">
          
          <!-- Loading State -->
          <div v-if="isPayingSimulating" class="my-auto py-12 flex flex-col items-center justify-center text-center space-y-4">
            <div class="relative w-16 h-16 flex items-center justify-center">
              <span class="absolute inset-0 rounded-full border-4 border-teal-500/15"></span>
              <span class="absolute inset-x-0 inset-y-0 rounded-full border-4 border-teal-400 border-t-transparent animate-spin"></span>
              <span class="material-symbols-outlined text-teal-400 text-3xl animate-pulse">payments</span>
            </div>
            <div>
              <p class="text-sm font-black text-white">{{ currentLang === 'km' ? 'កំពុងភ្ជាប់ទៅប្រព័ន្ធធនាគារ ABA...' : 'Contacting ABA Bank...' }}</p>
              <p class="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-widest">{{ currentLang === 'km' ? 'សូមរង់ចាំ ប្រតិបត្តិការកំពុងរៀបចំ' : 'Verifying digital wallet ledger...' }}</p>
            </div>
          </div>

          <!-- Successful Settle Receipt State -->
          <div v-else-if="isPayingSucceed" class="my-auto py-6 flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div class="w-16 h-16 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-bounce">
              <span class="material-symbols-outlined text-4xl font-black">done_all</span>
            </div>
            
            <div class="space-y-1">
              <h4 class="text-lg font-black text-white">{{ currentLang === 'km' ? 'ទូទាត់ប្រាក់បានជោគជ័យ' : 'Payment Successful!' }}</h4>
              <p class="text-xs font-bold text-teal-300 uppercase tracking-wider">{{ currentLang === 'km' ? 'ប្រាក់ត្រូវបានផ្ទេរដោយជោគជ័យ' : 'Funds transferred to merchant' }}</p>
            </div>

            <!-- Receipt Card -->
            <div class="w-full bg-[#001f33] border border-white/5 rounded-2xl p-4 text-left space-y-2.5 text-xs font-bold font-display shadow-inner">
              <div class="flex justify-between items-center text-slate-400 text-[10px] border-b border-white/5 pb-1.5 uppercase">
                <span>Receipt Summary</span>
                <span class="text-teal-400 font-black">ABA Reference</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-300 font-medium">Txn Reference</span>
                <span class="text-teal-300 font-black">{{ paymentSimulatedTxId }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-300 font-medium">Recipient Name</span>
                <span class="text-white">Gomeal Restaurant</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-300 font-medium">Table Settle</span>
                <span class="text-white">Table #{{ currentTable }}</span>
              </div>
              <div class="flex justify-between text-base border-t border-white/5 pt-2 font-display">
                <span class="text-white font-black">{{ currentLang === 'km' ? 'ទឹកប្រាក់សរុប' : 'Amount Settled' }}</span>
                <span class="text-[#1ebbc4] font-black">${{ billingAmount.toFixed(2) }}</span>
              </div>
            </div>

            <p class="text-[9px] text-slate-400 font-semibold leading-normal max-w-sm">
              {{ currentLang === 'km' ? 'កំណត់ត្រា និងការបញ្ជាទិញនៅលើតុរបស់អ្នកត្រូវបាន សម្អាតរួចរាល់ វិក្កយបត្រនេះត្រូវបានកត់ត្រាក្នុងចំណូលហាង។' : 'Your table session is fully settled. Active orders have been cleared and reported into register totals.' }}
            </p>
          </div>

          <!-- Checkout Details Slide to Pay -->
          <div v-else class="flex-1 flex flex-col justify-between py-1">
            <!-- Merchant Header detail -->
            <div class="bg-[#001f33] border border-white/5 rounded-2xl p-4 text-xs font-semibold mb-4 space-y-3">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0 border border-white/10 text-teal-400">
                  <span class="material-symbols-outlined text-teal-400">store</span>
                </div>
                <div>
                  <h4 class="font-black text-white text-sm">Gomeal Restaurant</h4>
                  <p class="text-[10px] text-slate-400 font-bold mt-0.5">ABA Merchant Account</p>
                </div>
              </div>

              <div class="border-t border-white/5 pt-3 space-y-2">
                <div class="flex justify-between">
                  <span class="text-slate-400 font-medium font-sans">Account ID</span>
                  <span class="text-white font-extrabold font-mono text-[11px]">011 218 525 010 0438</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-400 font-medium font-sans">Source Desk</span>
                  <span class="text-teal-400 font-extrabold">Table #{{ currentTable }}</span>
                </div>
                <div class="flex justify-between text-base border-t border-white/5 pt-2.5">
                  <span class="text-white font-black">{{ currentLang === 'km' ? 'ទឹកប្រាក់ត្រូវបង់' : 'Total Amount' }}</span>
                  <span class="text-[#1ebbc4] font-black">${{ billingAmount.toFixed(2) }}</span>
                </div>
              </div>
            </div>

            <!-- Authentic Touch Slide / Click To Pay Action Frame -->
            <div class="mt-auto space-y-3 shrink-0">
              <div class="text-center">
                <span class="text-[9px] font-black uppercase text-teal-400 tracking-widest block mb-1">Verify payment securely</span>
                <span class="text-[10px] text-slate-300 font-semibold leading-normal block">
                  {{ currentLang === 'km' ? 'សូមចុចប៊ូតុងខាងក្រោមដើម្បីអនុម័តការទូទាត់ប្រាក់គំរូ' : 'Click the action button below to instantly approve the simulated transaction' }}
                </span>
              </div>

              <!-- High fidelity CTA Action Button -->
              <button
                @click="executeSimulationPayment"
                class="w-full bg-teal-400 hover:bg-teal-300 text-slate-950 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-400/20 active:scale-98 hover:scale-[1.01] transition-all flex items-center justify-center gap-2 cursor-pointer outline-none border-none"
              >
                <span class="material-symbols-outlined text-sm font-black">mobile_friendly</span>
                {{ currentLang === 'km' ? 'យល់ព្រម និងទូទាត់លុយ' : 'Approve & Settle Via ABA' }}
              </button>
            </div>
          </div>
        </div>

        <!-- ABA App Simulator Sticky Footer -->
        <div class="p-4 bg-[#001f33] border-t border-white/5 flex gap-3 shrink-0">
          <button 
            @click="resetSimulationState"
            class="flex-1 bg-white/5 border border-white/10 hover:bg-white/10 text-white py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center outline-none cursor-pointer"
          >
            {{ isPayingSucceed ? (currentLang === 'km' ? 'បិទបង្អួច' : 'Close Sandbox') : (currentLang === 'km' ? 'ត្រឡប់ថយក្រោយ' : 'Go Back') }}
          </button>
        </div>
      </div>

      <!-- Mode 2: Normal QR Scanner / Manual Open Dialog -->
      <div 
        v-else
        class="bg-white rounded-[32px] max-w-sm w-full max-h-[92vh] sm:max-h-[85vh] overflow-hidden flex flex-col shadow-2xl border border-surface-variant/40 animate-in fade-in zoom-in-95 duration-300 pointer-events-auto"
      >
        <!-- Modal Head -->
        <div class="relative bg-surface-container p-4 sm:p-5 border-b border-surface-variant/40 shrink-0 text-center">
          <span class="material-symbols-outlined text-primary text-2xl mb-1 bg-primary/10 p-2 rounded-full animate-pulse">qr_code_scanner</span>
          <h3 class="text-base sm:text-lg font-black text-on-surface">{{ currentLang === 'km' ? 'ស្កេន និងទូទាត់ប្រាក់ (បាគង / KHQR)' : 'Scan & Pay (Bakong / KHQR)' }}</h3>
          <p class="text-[10px] sm:text-[11px] text-on-surface-variant/80 font-bold uppercase tracking-wider mt-0.5">{{ currentLang === 'km' ? 'ការទូទាត់ឌីជីថល តុលេខ #' + currentTable : 'Table #' + currentTable + ' Digital Settlement' }}</p>
          <button 
            @click="isPaymentQrModalOpen = false"
            class="absolute top-3 right-3 p-1.5 bg-white rounded-full hover:bg-surface-container text-outline hover:text-on-surface transition-all shadow-sm outline-none border-none cursor-pointer"
          >
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <!-- Contents -->
        <div class="p-4 sm:p-5 flex-1 overflow-y-auto min-h-0 flex flex-col items-center bg-slate-50/50 custom-scrollbar">
          
          <!-- Exact Money prominently shown on the top of the QR code -->
          <div class="text-center mb-3 sm:mb-4 w-full bg-white py-3.5 px-4 rounded-2xl border border-outline-variant/30 shadow-xs">
            <span class="text-[9px] sm:text-[10px] font-black text-outline uppercase tracking-widest block">{{ currentLang === 'km' ? 'ទឹកប្រាក់ត្រូវទូទាត់ជាក់ស្តែង' : 'Exact Payment Amount' }}</span>
            <span class="text-2xl sm:text-3xl font-black text-slate-900 mt-0.5 block">
              ${{ billingAmount.toFixed(2) }}
            </span>
            <div class="mt-1.5 flex items-center justify-center gap-1 text-[10px] sm:text-xs text-primary font-bold">
              <span class="material-symbols-outlined text-xs sm:text-sm">info</span>
              <span>{{ currentLang === 'km' ? 'ការទូទាត់រួមបញ្ចូលមុខម្ហូបតុនេះទាំងអស់' : 'Scanning settles all active table items' }}</span>
            </div>
          </div>

          <!-- DIRECT AUTO ABA LAUNCHER LINK -->
          <div class="w-full bg-white rounded-2xl p-3.5 border border-emerald-200 shadow-3xs mb-3.5 flex flex-col justify-between gap-3 shrink-0">
            <div class="flex items-start gap-2.5">
              <span class="material-symbols-outlined text-emerald-600 font-black text-lg shrink-0 p-1.5 bg-emerald-50 rounded-xl animate-bounce">phonelink_ring</span>
              <div class="min-w-0 flex-1">
                <h4 class="text-xs font-black text-slate-800 leading-snug">{{ currentLang === 'km' ? 'តំណភ្ជាប់ទៅកម្មវិធី ABA Mobile / KHQR' : 'ABA Mobile App Scan Integration' }}</h4>
                <p class="text-[10px] text-slate-500 font-bold mt-1 leading-relaxed">
                  {{ currentLang === 'km' ? 'ប្រព័ន្ធបានបញ្ជូនកូដទូទាត់នេះតាម deep-link។ ប្រសិនបើកម្មវិធី ABA មិនបើកដោយស្វ័យប្រវត្តទេ សូមជ្រើសរើសជម្រើសខាងក្រោម៖' : 'We prefilled your bill payload. If your ABA banking app did not launch automatically, use these controls:' }}
                </p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 mt-0.5">
              <button
                @click="triggerAbaDeepLink"
                type="button"
                class="bg-[#002e48] hover:bg-[#002438] text-white py-2.5 px-3 rounded-xl text-center font-black text-[10px] tracking-wide flex items-center justify-center gap-1 border-none shadow-sm active:scale-95 transition-all outline-none cursor-pointer"
              >
                <span class="material-symbols-outlined text-[13px] text-teal-400">bolt</span>
                {{ currentLang === 'km' ? 'បើក ABA ផ្ទាល់' : 'Deep Link ABA' }}
              </button>
              
              <button
                @click="isAbaSimulatorOpen = true"
                type="button"
                class="bg-amber-600 hover:bg-amber-700 text-white py-2.5 px-3 rounded-xl text-center font-black text-[10px] tracking-wide flex items-center justify-center gap-1 border-none shadow-sm active:scale-95 transition-all outline-none cursor-pointer"
              >
                <span class="material-symbols-outlined text-[13px] text-amber-200 font-black">science</span>
                {{ currentLang === 'km' ? 'សាកល្បង ABA Sim' : 'Live ABA Sim' }}
              </button>
            </div>
          </div>

          <!-- Segmented Toggle Control for QR Type -->
          <div class="w-full grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/50 mb-3 sm:mb-4 shrink-0">
            <button
              @click="qrType = 'dynamic'"
              type="button"
              :class="[
                'py-1.5 px-3 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 outline-none border-none cursor-pointer',
                qrType === 'dynamic' ? 'bg-white text-primary shadow-xs border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              <span class="material-symbols-outlined text-[13px]">bolt</span>
              {{ currentLang === 'km' ? 'វិក្កយបត្រឌីជីថល' : 'Dynamic Bill' }}
            </button>
            <button
              @click="qrType = 'static'"
              type="button"
              :class="[
                'py-1.5 px-3 text-[11px] sm:text-xs font-bold rounded-lg transition-all text-center flex items-center justify-center gap-1 outline-none border-none cursor-pointer',
                qrType === 'static' ? 'bg-white text-primary shadow-xs border border-slate-200/30' : 'text-slate-500 hover:text-slate-800'
              ]"
            >
              <span class="material-symbols-outlined text-[13px]">restaurant_menu</span>
              {{ currentLang === 'km' ? 'QR កូដទូទៅ' : 'Static QR' }}
            </button>
          </div>

          <!-- QR Code Container -->
          <div class="relative bg-white p-4 rounded-3xl shadow-md border border-outline-variant/40 flex items-center justify-center w-[180px] h-[180px] sm:w-[200px] sm:h-[200px] shrink-0">
            <img 
              :src="qrType === 'dynamic' ? getQrUrl(khqrData) : getQrUrl(staticKhqrData)" 
              alt="Payment QR" 
              class="w-full h-full object-contain rounded-2xl"
              referrerPolicy="no-referrer"
            />
            
            <!-- Beautiful Central Logo Overlay matching Cambodian Banking Apps -->
            <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md border-2 border-white scale-105">
                <div class="w-7 h-7 bg-red-600 rounded-full flex items-center justify-center">
                  <span class="text-white text-[10px] font-extrabold tracking-tighter shrink-0 select-none font-sans">KH</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SCAN TROUBLESHOOTING & INSTANT AUTO PAY -->
          <div class="w-full bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 mt-4 text-left shadow-2xs shrink-0 flex flex-col gap-2.5">
            <div class="flex items-start gap-2">
              <span class="material-symbols-outlined text-amber-600 font-extrabold text-lg mt-0.5 shrink-0 animate-pulse">warning</span>
              <div class="min-w-0 flex-1">
                <h4 class="text-[11px] font-black text-amber-950 uppercase tracking-wider leading-none">{{ currentLang === 'km' ? 'បញ្ហាស្កេនមែនទេ?' : 'Having Scanning Issues?' }}</h4>
                <p class="text-[10px] text-amber-900 font-semibold mt-1 leading-relaxed">
                  {{ currentLang === 'km' ? 'ប្រសិនបើការស្កេនជាមួយកម្មវិធី ABA របស់អ្នកបង្ហាញថា "Invalid Qr Merchant Data" គឺមកពីនេះជាគណនីគំរូសាកល្បងរបស់ប្រព័ន្ធ។' : 'If scanning with your real phone bank app displays "Invalid Qr Merchant Data", it is because this account is a mock sandbox demonstrator.' }}
                </p>
              </div>
            </div>
            
            <!-- Action to auto-pay -->
            <button
              @click="payWithSimulatorDirectly"
              type="button"
              class="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl py-2.5 px-3 font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-xs border-none cursor-pointer outline-none active:scale-95 transition-all animate-pulse"
            >
              <span class="material-symbols-outlined text-sm">payments</span>
              <span>{{ currentLang === 'km' ? 'ចុចទីនេះដើម្បីបំពេញការទូទាត់គំរូ និងសម្អាតតុ' : 'Simulate Success & Clear Table Instantly' }}</span>
            </button>
          </div>

          <!-- Instruction Details below QR -->
          <div class="mt-3.5 sm:mt-4 text-center space-y-1">
            <p class="text-xs font-black text-slate-800">{{ currentLang === 'km' ? 'សូមស្កេនជាមួយ TosEat ឬកម្មវិធីធនាគារនានា' : 'Scan with TosEat OS or Banking Apps' }}</p>
            <p class="text-[10px] sm:text-[11px] text-slate-500 font-bold leading-relaxed px-1">
              {{ currentLang === 'km' ? 'អាចប្រើបានជាមួយ ABA Pay, Bakong និងកម្មវិធីកាបូបអេឡិចត្រូនិកដែលគាំទ្រ KHQR។ ស្ថានភាពការបញ្ជាទិញរបស់អ្នកនឹងប្តូរទៅជា "រង់ចាំការបញ្ជាក់ពីអ្នកគិតលុយ" ដោយស្វ័យប្រវត្តិ។' : 'Valid for ABA Pay, Bakong, and KHQR-supported e-wallet applications. Your order state will automatically set to "Pending Cashier confirmation".' }}
            </p>
          </div>
        </div>

        <!-- Sticky Footer actions -->
        <div class="p-4 sm:p-5 bg-white border-t border-surface-variant/40 flex shrink-0">
          <button 
            @click="isPaymentQrModalOpen = false"
            class="w-full bg-white border border-outline hover:bg-slate-50 text-slate-700 py-2.5 sm:py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center outline-none cursor-pointer"
          >
            {{ currentLang === 'km' ? 'ត្រឡប់ក្រោយ' : 'Go Back' }}
          </button>
        </div>
      </div>
    </div>

    <!-- NOTIFICATION TOAST -->
    <div 
      v-if="isOrderSuccessToastVisible"
      class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white py-4 px-6 rounded-2xl shadow-2xl flex items-center gap-3.5 z-50 font-black text-xs animate-in slide-in-from-bottom duration-300 max-w-md w-11/12"
    >
      <div class="bg-emerald-500 text-slate-900 w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-lg">
        <span class="material-symbols-outlined text-sm font-black">check</span>
      </div>
      <div class="flex-1">
        <p class="font-black text-white leading-relaxed">{{ orderSuccessMessage }}</p>
      </div>
      <button @click="isOrderSuccessToastVisible = false" class="text-slate-400 hover:text-white transition-colors shrink-0">
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
