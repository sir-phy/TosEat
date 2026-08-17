import jwt from 'jsonwebtoken'

export const JWT_SECRET = process.env.JWT_SECRET || 'gomeal-super-secret-jwt-key-2026'

export interface User {
  id: number
  name: string
  email: string
  passwordHash: string
  role: 'MANAGER' | 'CASHIER' | 'CHEF' | 'CUSTOMER'
  role_id: number
  status: 'ACTIVE' | 'INACTIVE'
  phone?: string
  avatar?: string
  tableId?: number | null
  createdAt?: string
  lastLogin?: string
}

export interface Category {
  id: number
  name: string
  description?: string
  icon?: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface Ingredient {
  id: number
  name: string
  unit: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface MenuItemIngredient {
  ingredientId: number
  name?: string
  amount: number
  unit: string
}

export interface MenuItem {
  id: number
  category_id: number
  name: string
  description?: string
  price: number
  calories?: number
  image?: string
  status: 'AVAILABLE' | 'SOLD_OUT' | 'INACTIVE'
  ingredients: MenuItemIngredient[]
}

export interface RestaurantTable {
  id: number
  table_number: string
  name?: string
  capacity: number
  location?: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'INACTIVE'
}

export interface BillingRequest {
  id: number
  tableId: number
  table: {
    id: number
    tableNumber: string
  }
  status: 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CANCELLED'
  orderIds: number[]
  orders: Order[]
  subtotal: number
  tax: number
  discount: number
  totalAmount: number
  cashierId?: number
  cashierName?: string
  paymentId?: number
  createdAt: string
  updatedAt: string
  resolvedAt?: string | null
}

export interface Payment {
  id: number
  billingRequestId?: number
  orderId?: number
  tableId: number
  amount: number
  currency: 'USD' | 'KHR'
  method: 'CASH' | 'KHQR' | 'CARD'
  status: 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'REFUNDED'
  amountReceived?: number
  changeAmount?: number
  qrData?: string
  md5?: string
  hash?: string
  shortHash?: string
  transactionReference?: string
  paidAt?: string | null
  createdAt: string
  updatedAt: string
  expiresAt?: string
}

export interface Invoice {
  id: number
  invoiceNumber: string
  paymentId: number
  paymentMethod: string
  tableId: number
  tableNumber: string
  orderIds: number[]
  orders: Order[]
  subtotal: number
  tax: number
  discount: number
  total: number
  currency: 'USD' | 'KHR'
  status: 'ISSUED' | 'CANCELLED'
  cancelReason?: string
  cancelledAt?: string | null
  reprintCount: number
  createdAt: string
}

export interface OrderItemCustomization {
  ingredientId: number
  name?: string
  originalAmount?: number
  amount: number
  unit?: string
  difference?: number
  isIncrease?: boolean
}

export interface OrderItem {
  id: number
  menuItemId: number
  name: string
  unitPrice: number
  quantity: number
  subtotal: number
  image?: string
  customizations: OrderItemCustomization[]
  customizationNote?: string
}

export interface OrderHistoryEntry {
  status: 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED'
  timestamp: string
  note?: string
}

export interface Order {
  id: number
  orderNumber: string
  customerId?: number
  customerName?: string
  tableId: number
  table: {
    id: number
    tableNumber: string
  }
  status: 'PENDING' | 'SENT_TO_KITCHEN' | 'PREPARING' | 'READY' | 'SERVED' | 'PAID' | 'CANCELLED'
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod?: string
  paymentStatus?: 'UNPAID' | 'PAID'
  items: OrderItem[]
  history: OrderHistoryEntry[]
  createdAt: string
  updatedAt: string
  servedAt?: string | null
  paidAt?: string | null
  cancelledAt?: string | null
}

export interface CustomerNotification {
  id: number
  tableId: number
  orderId: number
  type: 'COOKING_STARTED' | 'FOOD_READY' | 'ORDER_SERVED' | 'DELAY_NOTICE' | 'GENERAL'
  message: string
  status: 'UNREAD' | 'READ'
  createdAt: string
  readAt?: string | null
}

// In-Memory Seeded Database
class Database {
  users: User[] = []
  categories: Category[] = []
  ingredients: Ingredient[] = []
  menuItems: MenuItem[] = []
  tables: RestaurantTable[] = []
  orders: Order[] = []
  notifications: CustomerNotification[] = []
  billingRequests: BillingRequest[] = []
  payments: Payment[] = []
  invoices: Invoice[] = []

  private orderSeq = 1000
  private notifSeq = 1
  private userSeq = 10
  private billingSeq = 500
  private paymentSeq = 700
  private invoiceSeq = 900

  constructor() {
    this.seed()
  }

  seed() {
    const now = new Date()
    // 1. Seeded Users
    this.users = [
      {
        id: 1,
        name: 'Restaurant Manager',
        email: 'manager@example.com',
        passwordHash: 'password',
        role: 'MANAGER',
        role_id: 1,
        status: 'ACTIVE',
        phone: '+855 12 345 678',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 60).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 15).toISOString()
      },
      {
        id: 2,
        name: 'Front Cashier (Sophea)',
        email: 'cashier@example.com',
        passwordHash: 'password',
        role: 'CASHIER',
        role_id: 2,
        status: 'ACTIVE',
        phone: '+855 16 888 999',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 45).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 45).toISOString()
      },
      {
        id: 3,
        name: 'Head Chef (Chanthou)',
        email: 'chef@example.com',
        passwordHash: 'password',
        role: 'CHEF',
        role_id: 3,
        status: 'ACTIVE',
        phone: '+855 77 222 333',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 40).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 120).toISOString()
      },
      {
        id: 4,
        name: 'Sous Chef (Socheat)',
        email: 'socheat.chef@example.com',
        passwordHash: 'password',
        role: 'CHEF',
        role_id: 3,
        status: 'ACTIVE',
        phone: '+855 92 111 222',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 25).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 300).toISOString()
      },
      {
        id: 5,
        name: 'Evening Cashier (Dara)',
        email: 'dara.cashier@example.com',
        passwordHash: 'password',
        role: 'CASHIER',
        role_id: 2,
        status: 'ACTIVE',
        phone: '+855 89 444 555',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 20).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 60 * 5).toISOString()
      },
      {
        id: 6,
        name: 'VIP Guest (Alice Johnson)',
        email: 'alice@example.com',
        passwordHash: 'password',
        role: 'CUSTOMER',
        role_id: 4,
        status: 'ACTIVE',
        phone: '+855 98 777 666',
        tableId: 1,
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        lastLogin: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: 7,
        name: 'Guest Member (Bob Smith)',
        email: 'bob@example.com',
        passwordHash: 'password',
        role: 'CUSTOMER',
        role_id: 4,
        status: 'INACTIVE',
        phone: '+855 10 333 444',
        createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(),
        lastLogin: null
      }
    ]

    // 2. Seeded Categories
    this.categories = [
      { id: 1, name: 'Burger', description: 'Gourmet artisanal burgers', icon: 'lunch_dining', status: 'ACTIVE' },
      { id: 2, name: 'Pizza', description: 'Stone oven baked pizzas', icon: 'local_pizza', status: 'ACTIVE' },
      { id: 3, name: 'Bakery', description: 'Fresh oven pastries and breads', icon: 'bakery_dining', status: 'ACTIVE' },
      { id: 4, name: 'Beverage', description: 'Craft drinks, shakes and smoothies', icon: 'local_bar', status: 'ACTIVE' },
      { id: 5, name: 'Chicken', description: 'Crispy and roasted chicken delights', icon: 'dinner_dining', status: 'ACTIVE' },
      { id: 6, name: 'Seafood', description: 'Ocean fresh delicacies and mains', icon: 'set_meal', status: 'ACTIVE' }
    ]

    // 3. Seeded Ingredients
    this.ingredients = [
      { id: 1, name: 'Beef Patty', unit: 'pcs', status: 'ACTIVE' },
      { id: 2, name: 'Double Cheddar', unit: 'pcs', status: 'ACTIVE' },
      { id: 3, name: 'Lettuce', unit: 'kg', status: 'ACTIVE' },
      { id: 4, name: 'Tomato', unit: 'kg', status: 'ACTIVE' },
      { id: 5, name: 'Pickles', unit: 'pcs', status: 'ACTIVE' },
      { id: 6, name: 'Pepperoni', unit: 'kg', status: 'ACTIVE' },
      { id: 7, name: 'Mozzarella', unit: 'kg', status: 'ACTIVE' },
      { id: 8, name: 'Tomato Sauce', unit: 'kg', status: 'ACTIVE' },
      { id: 9, name: 'Basil', unit: 'pcs', status: 'ACTIVE' },
      { id: 10, name: 'Pork Chashu', unit: 'pcs', status: 'ACTIVE' },
      { id: 11, name: 'Ramen Noodles', unit: 'kg', status: 'ACTIVE' },
      { id: 12, name: 'Soft Boiled Egg', unit: 'pcs', status: 'ACTIVE' },
      { id: 13, name: 'Nori', unit: 'pcs', status: 'ACTIVE' },
      { id: 14, name: 'Rice', unit: 'kg', status: 'ACTIVE' },
      { id: 15, name: 'Shrimp', unit: 'pcs', status: 'ACTIVE' },
      { id: 16, name: 'Eggs', unit: 'pcs', status: 'ACTIVE' },
      { id: 17, name: 'Green Beans', unit: 'kg', status: 'ACTIVE' },
      { id: 18, name: 'Carrots', unit: 'kg', status: 'ACTIVE' },
      { id: 19, name: 'Avocado', unit: 'pcs', status: 'ACTIVE' },
      { id: 20, name: 'Quinoa', unit: 'kg', status: 'ACTIVE' },
      { id: 21, name: 'Baby Spinach', unit: 'kg', status: 'ACTIVE' },
      { id: 22, name: 'Citrus Dressing', unit: 'portions', status: 'ACTIVE' },
      { id: 23, name: 'Blueberries', unit: 'kg', status: 'ACTIVE' },
      { id: 24, name: 'Strawberries', unit: 'kg', status: 'ACTIVE' },
      { id: 25, name: 'Almond Milk', unit: 'kg', status: 'ACTIVE' },
      { id: 26, name: 'Chia Seeds', unit: 'portions', status: 'ACTIVE' }
    ]

    // 4. Seeded Menu Items
    this.menuItems = [
      {
        id: 1,
        category_id: 1,
        name: 'Cheese Burger',
        description: 'Classic beef patty with double cheddar cheese and secret sauce.',
        price: 12.50,
        calories: 580,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_58biya1paABTH6IL_cgl_57LeZ4J5ymsHNKEy_VgPxuOxJsNzXiFFL135exa1t8AFxAE6I2fw5HKu9sHfNi9f41xaGgw4NHdDHoFGJ3h0leJQEHhoHysmGLRxhQglZXOUTufuK9mHEbWp_8WFmSd3I687QvKMW_7--1nuVG5f9exmfqQTX38IjGOQI0saGNCydZ5B9nsRTYYoocZY18TGGQzVSVqgxv7r-xbwN3vB_Ia08uSSmBQQ3u1IkcUBkKEXrguPvWYPwE',
        status: 'AVAILABLE',
        ingredients: [
          { ingredientId: 1, name: 'Beef Patty', amount: 1, unit: 'pcs' },
          { ingredientId: 2, name: 'Double Cheddar', amount: 2, unit: 'pcs' },
          { ingredientId: 3, name: 'Lettuce', amount: 0.1, unit: 'kg' },
          { ingredientId: 4, name: 'Tomato', amount: 0.05, unit: 'kg' },
          { ingredientId: 5, name: 'Pickles', amount: 3, unit: 'pcs' }
        ]
      },
      {
        id: 2,
        category_id: 2,
        name: 'Pepperoni Pizza',
        description: 'Thin crust loaded with spicy pepperoni and fresh basil leaves.',
        price: 18.99,
        calories: 720,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBn_wQVFevzLu7CLLK6i1DUbE4eUpTsNcL2p1TlHzbasPYJ43fxF_KY9mRVhUMxxkwowt4nE6ZwAhQwrmJZhBoqjI5iHvrGm9Etl8sRi72FAXlcXfMX5XPXgBDUc3gRFI6WikKkXjLO8OEfi4js9K1axMXIW1NmE_2q96u97b8gMHqLs4q0Fd_1eKSCI3ohngtjWsOU-zsYqO6dCUgqvE5p30HKZanVNmN5i53eSh2EAsKg5mNhsif8WaIQAH9XHl4dar45pCrX_58',
        status: 'AVAILABLE',
        ingredients: [
          { ingredientId: 6, name: 'Pepperoni', amount: 0.15, unit: 'kg' },
          { ingredientId: 7, name: 'Mozzarella', amount: 0.25, unit: 'kg' },
          { ingredientId: 8, name: 'Tomato Sauce', amount: 0.1, unit: 'kg' },
          { ingredientId: 9, name: 'Basil', amount: 5, unit: 'pcs' }
        ]
      },
      {
        id: 3,
        category_id: 6,
        name: 'Japanese Ramen',
        description: 'Creamy pork broth with handmade noodles and chashu pork.',
        price: 15.00,
        calories: 640,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAkQEYh62Uq3uI0scRBpNgbuk1ev0ew2sBJf7uQcaylYTswLRyJXkdb73XpedlHXlmKg4c0jqAUERG2j6EdTIhay4NJ8I_UBYy1JLj72razpWKissFHWCd3sCYqR5PiMLihgTzqKlE4OwT2QyUIMNYW2atLNB7-IaXY_o6ttjhNiUQRhQOd3iq_cnWNSvAcFgxsJFaZaBhXgIaVuiiigWycOSnRTFUAM26Q4RYa8cT__JA2Gz_kE7ub-rTXjCqiGtstZ4xxSqtN8fY',
        status: 'SOLD_OUT',
        ingredients: [
          { ingredientId: 10, name: 'Pork Chashu', amount: 2, unit: 'pcs' },
          { ingredientId: 11, name: 'Ramen Noodles', amount: 0.2, unit: 'kg' },
          { ingredientId: 12, name: 'Soft Boiled Egg', amount: 1, unit: 'pcs' },
          { ingredientId: 13, name: 'Nori', amount: 2, unit: 'pcs' }
        ]
      },
      {
        id: 4,
        category_id: 6,
        name: 'Fried Rice',
        description: 'Wok-fried rice with assorted vegetables and authentic spices.',
        price: 10.45,
        calories: 490,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAeoQ8xKRkzOfh3Z60Ys1Jmz5dtxwaQ2At2vXesV1lrlwYme3Hlaxi1cBmQKNqkdBEHPRNwWPGwNYHUgR0zq_exdP5bSQNfaMUStNv-E_5TeKbRDtrTIj5lh9Jshm_DE4Gj-5a6nzvt5AbxnQx_1gdHVFOUBPbarRNw1CtCuQigr5SmI-7piZPF-3eUiNv1IydEzZ3wgzzk7uYgNOJz0motcUBOwkJRZLpvnWD09MJa4hsjatq62s8bFFlplAyN0mvgZDQi56in_qA',
        status: 'AVAILABLE',
        ingredients: [
          { ingredientId: 14, name: 'Rice', amount: 0.3, unit: 'kg' },
          { ingredientId: 15, name: 'Shrimp', amount: 8, unit: 'pcs' },
          { ingredientId: 16, name: 'Eggs', amount: 2, unit: 'pcs' },
          { ingredientId: 17, name: 'Green Beans', amount: 0.05, unit: 'kg' },
          { ingredientId: 18, name: 'Carrots', amount: 0.05, unit: 'kg' }
        ]
      },
      {
        id: 5,
        category_id: 1,
        name: 'Vegan Salad',
        description: 'Fresh organic garden greens with avocado and citrus dressing.',
        price: 13.20,
        calories: 320,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB2f87RJ0hfrSnVevXnLA3Lg8MNMeEkQvS9epwQ1cL-bucPLyQ3nfQw1Jh4TJnGyd_6AJFchvYZg2gK9EA3mvZYqNqCW5wuGU10hkFexUycT8COdSumTWAt8D8HLWfOIMT5uLXz6rX22v-nUSjLTJYoI8zouLgvXnhi5CJX2Febib8skbVb8-EsD7SFKauxL1NhYbtjBQBzEeg1w868Rs3s2RPeYW71C-ciiZn85xTWGNqs930ixpjkrYK3VDEQ38sfaya9lG9Xe4I',
        status: 'AVAILABLE',
        ingredients: [
          { ingredientId: 19, name: 'Avocado', amount: 1, unit: 'pcs' },
          { ingredientId: 20, name: 'Quinoa', amount: 0.1, unit: 'kg' },
          { ingredientId: 21, name: 'Baby Spinach', amount: 0.15, unit: 'kg' },
          { ingredientId: 22, name: 'Citrus Dressing', amount: 2, unit: 'portions' }
        ]
      },
      {
        id: 6,
        category_id: 4,
        name: 'Berry Smoothie',
        description: 'Antioxidant rich blend of blueberries, strawberries and almond milk.',
        price: 7.50,
        calories: 220,
        image: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCbFAS4iTYwi5ycdwRD7J95XSa-Omxa-O1JYiDMcakgZuHILdB0DIGPpRVDxDYfDJ4D_s4QJK8wo-vWQEjqFT-ixPcVEqpXrh41stH45aQ4LRjLE2aqSQ3O8nn2CQH6nX6bpDQ8ezZG73QPe7p-FVFt2nWNT8YrC-ZCvg6tku66rzTC4Rd5QdjQipy6xPNsUpjh1Ohei6AXpwFzSShIBoF_mLn3T_dq-rh1JYWe1k3Shoj_2qDne3ec0X-bsvwTAvIDfhzQBVFIhs8',
        status: 'AVAILABLE',
        ingredients: [
          { ingredientId: 23, name: 'Blueberries', amount: 0.08, unit: 'kg' },
          { ingredientId: 24, name: 'Strawberries', amount: 0.12, unit: 'kg' },
          { ingredientId: 25, name: 'Almond Milk', amount: 0.25, unit: 'kg' },
          { ingredientId: 26, name: 'Chia Seeds', amount: 1, unit: 'portions' }
        ]
      }
    ]

    // 5. Seeded Tables
    const tableConfigs = [
      { num: '01', name: 'Window Booth 1', cap: 4, loc: 'Main Dining', status: 'AVAILABLE' as const },
      { num: '02', name: 'Terrace Garden 2', cap: 4, loc: 'Outdoor Patio', status: 'OCCUPIED' as const },
      { num: '04', name: 'Cozy Corner 4', cap: 2, loc: 'Main Dining', status: 'AVAILABLE' as const },
      { num: '08', name: 'Family Table 8', cap: 6, loc: 'Family Section', status: 'AVAILABLE' as const },
      { num: '12B', name: 'VIP Booth 12B', cap: 6, loc: 'VIP Lounge', status: 'OCCUPIED' as const },
      { num: '15', name: 'Bar High-top 15', cap: 4, loc: 'Bar Area', status: 'AVAILABLE' as const },
      { num: '18', name: 'Balcony View 18', cap: 4, loc: 'Balcony', status: 'AVAILABLE' as const },
      { num: '22', name: 'Executive Suite 22', cap: 8, loc: 'VIP Lounge', status: 'AVAILABLE' as const }
    ]
    this.tables = tableConfigs.map((cfg, i) => ({
      id: i + 1,
      table_number: cfg.num,
      name: cfg.name,
      capacity: cfg.cap,
      location: cfg.loc,
      status: cfg.status
    }))

    // 6. Seeded Initial Orders
    this.orders = [
      {
        id: 1001,
        orderNumber: 'ORD-20260813-1001',
        tableId: 5, // Table 12B
        table: { id: 5, tableNumber: '12B' },
        status: 'PREPARING',
        subtotal: 25.00,
        discount: 0,
        tax: 2.50,
        total: 27.50,
        paymentStatus: 'UNPAID',
        items: [
          {
            id: 1,
            menuItemId: 1,
            name: 'Cheese Burger',
            unitPrice: 12.50,
            quantity: 2,
            subtotal: 25.00,
            image: this.menuItems[0].image,
            customizations: [
              { ingredientId: 2, name: 'Double Cheddar', originalAmount: 2, amount: 3, unit: 'pcs', difference: 1, isIncrease: true }
            ],
            customizationNote: 'Double Cheddar: 2 -> 3 pcs'
          }
        ],
        history: [
          { status: 'PENDING', timestamp: new Date(now.getTime() - 900000).toISOString() },
          { status: 'SENT_TO_KITCHEN', timestamp: new Date(now.getTime() - 800000).toISOString() },
          { status: 'PREPARING', timestamp: new Date(now.getTime() - 500000).toISOString() }
        ],
        createdAt: new Date(now.getTime() - 900000).toISOString(),
        updatedAt: new Date(now.getTime() - 500000).toISOString()
      },
      {
        id: 1002,
        orderNumber: 'ORD-20260813-1002',
        tableId: 2, // Table 02
        table: { id: 2, tableNumber: '02' },
        status: 'READY',
        subtotal: 18.99,
        discount: 0,
        tax: 1.90,
        total: 20.89,
        paymentStatus: 'UNPAID',
        items: [
          {
            id: 2,
            menuItemId: 2,
            name: 'Pepperoni Pizza',
            unitPrice: 18.99,
            quantity: 1,
            subtotal: 18.99,
            image: this.menuItems[1].image,
            customizations: [],
            customizationNote: 'Standard Portions'
          }
        ],
        history: [
          { status: 'PENDING', timestamp: new Date(now.getTime() - 1500000).toISOString() },
          { status: 'SENT_TO_KITCHEN', timestamp: new Date(now.getTime() - 1400000).toISOString() },
          { status: 'PREPARING', timestamp: new Date(now.getTime() - 1000000).toISOString() },
          { status: 'READY', timestamp: new Date(now.getTime() - 200000).toISOString() }
        ],
        createdAt: new Date(now.getTime() - 1500000).toISOString(),
        updatedAt: new Date(now.getTime() - 200000).toISOString()
      }
    ]

    // 7. Seeded Notifications
    this.notifications = [
      {
        id: 1,
        tableId: 5,
        orderId: 1001,
        type: 'COOKING_STARTED',
        message: 'We start cooking now, Please wait a moment☺️.',
        status: 'UNREAD',
        createdAt: new Date(now.getTime() - 500000).toISOString(),
        readAt: null
      }
    ]

    // 8. Seeded Billing Requests & Payments & Invoices
    this.billingRequests = [
      {
        id: 501,
        tableId: 2, // Table 02
        table: { id: 2, tableNumber: '02' },
        status: 'PENDING',
        orderIds: [1002],
        orders: [this.orders[1]],
        subtotal: 18.99,
        discount: 0,
        tax: 1.90,
        totalAmount: 20.89,
        createdAt: new Date(now.getTime() - 100000).toISOString(),
        updatedAt: new Date(now.getTime() - 100000).toISOString(),
        resolvedAt: null
      }
    ]

    this.payments = []
    this.invoices = []
  }

  nextOrderId() {
    this.orderSeq += 1
    return this.orderSeq
  }

  nextNotifId() {
    this.notifSeq += 1
    return this.notifSeq
  }

  nextUserId() {
    this.userSeq += 1
    return this.userSeq
  }

  nextBillingId() {
    this.billingSeq += 1
    return this.billingSeq
  }

  nextPaymentId() {
    this.paymentSeq += 1
    return this.paymentSeq
  }

  nextInvoiceId() {
    this.invoiceSeq += 1
    return this.invoiceSeq
  }
}

export const db = new Database()
