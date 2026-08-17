import { ref } from 'vue'

export type Language = 'en' | 'km'

export const currentLang = ref<Language>((localStorage.getItem('gomeal_lang') as Language) || 'en')

export function setLang(lang: Language) {
  currentLang.value = lang
  localStorage.setItem('gomeal_lang', lang)
}

// Global localization translates function helper
export function t(key: string): string {
  const dictionary = (translations as any)[currentLang.value] || translations['en']
  const value = dictionary[key]
  if (value !== undefined) {
    return value
  }
  // Fallback to English if key doesn't exist in translation dictionary
  return (translations['en'] as any)[key] || String(key)
}

export const dishTranslations: Record<string, Record<Language, { name: string; desc: string }>> = {
  'Cheese Burger': {
    en: { name: 'Cheese Burger', desc: 'Classic beef patty with double cheddar cheese and secret sauce.' },
    km: { name: 'ប៊ឺហ្គឺរសាច់គោឈីស', desc: 'សាច់គោបន្ទះពិសេសជាមួយឈីសឆេដដាពីរជាន់ និងទឹកជ្រលក់សម្ងាត់គ្រួសារ។' }
  },
  'Pepperoni Pizza': {
    en: { name: 'Pepperoni Pizza', desc: 'Thin crust loaded with spicy pepperoni and fresh basil leaves.' },
    km: { name: 'ភីហ្សាផេបភឺរ៉ូនី', desc: 'នំបុ័ងភីហ្សាស្តើងស្រួយ លាបជាមួយទឹកជ្រលក់ប៉េងប៉ោះ គ្របដណ្តប់ដោយសាច់ផេបភឺរ៉ូនីហឹរ និងជីរវ៉ាន់ស៊ុយស្រស់។' }
  },
  'Japanese Ramen': {
    en: { name: 'Japanese Ramen', desc: 'Creamy pork broth with handmade noodles and chashu pork.' },
    km: { name: 'រ៉ាមេនជប៉ុន', desc: 'ទំពាំងបាយជូរសាច់ជ្រូកខាប់ពិសេស ញ៉ាំជាមួយមីធ្វើដោយដៃ និងសាច់ជ្រូកឆាឆឺរ។' }
  },
  'Fried Rice': {
    en: { name: 'Fried Rice', desc: 'Wok-fried rice with assorted vegetables and authentic spices.' },
    km: { name: 'បាយឆាគ្រឿងសមុទ្រ', desc: 'បាយឆាក្តៅៗជាមួយបន្លែចម្រុះជាច្រើនមុខ និងគ្រឿងទេសរសជាតិដើមបែបបុរាណ។' }
  },
  'Vegan Salad': {
    en: { name: 'Vegan Salad', desc: 'Fresh organic garden greens with avocado and citrus dressing.' },
    km: { name: 'សាឡាត់បន្លែសុខភាព', desc: 'បន្លែសរីរាង្គស្រស់ៗពីចម្ការ ញ៉ាំជាមួយផ្លែបឺរ និងទឹកជ្រលក់ក្រូចឆ្មារ។' }
  },
  'Berry Smoothie': {
    en: { name: 'Berry Smoothie', desc: 'Antioxidant rich blend of blueberries, strawberries and almond milk.' },
    km: { name: 'ទឹកក្រឡុកប៊ឺរី', desc: 'ការលាយបញ្ចូលគ្នានៃផ្លែប៊្លូប៊ឺរី ស្រ្តប៊ឺរី និងទឹកដោះគោអាល់ម៉ុនដ៏សម្បូរបែប។' }
  },
  'Classic Burger + Fried Rice': {
    en: { name: 'Classic Burger + Fried Rice', desc: 'The ultimate hunger-crusher combo for two.' },
    km: { name: 'ឈុតប៊ឺហ្គឺរ + បាយឆាគ្រឿងសមុទ្រ', desc: 'ឈុតអាហារសម្រន់ឆ្ងាញ់ពិសាសម្រាប់ញ៉ាំគ្នាពីរនាក់' }
  }
}

export const ingredientTranslations: Record<string, Record<Language, string>> = {
  'Beef Patty': { en: 'Beef Patty', km: 'សាច់គោកិន' },
  'Double Cheddar': { en: 'Double Cheddar', km: 'ឈីសឆេដដាតម្រួត' },
  'Lettuce': { en: 'Lettuce', km: 'បន្លែសាឡាត់' },
  'Tomato': { en: 'Tomato', km: 'ប៉េងប៉ោះ' },
  'Pickles': { en: 'Pickles', km: 'ជ្រក់ត្រសក់' },
  'Pepperoni': { en: 'Pepperoni', km: 'សាច់ក្រកហឹរផេបភឺរ៉ូនី' },
  'Mozzarella': { en: 'Mozzarella', km: 'ឈីសម៉ូហ្សារ៉េឡា' },
  'Tomato Sauce': { en: 'Tomato Sauce', km: 'ទឹកប៉េងប៉ោះប៉ាស្តា' },
  'Basil': { en: 'Basil', km: 'ជីរនាងវង / ជីរបាស៊ីល' },
  'Pork Chashu': { en: 'Pork Chashu', km: 'សាច់ជ្រូកចាស៊ូ' },
  'Ramen Noodles': { en: 'Ramen Noodles', km: 'មីរ៉ាមេនផ្ទាល់ដៃ' },
  'Soft Boiled Egg': { en: 'Soft Boiled Egg', km: 'ពងទាចៀនជ័រភ្នំភ្លើង' },
  'Nori': { en: 'Nori', km: 'សារាយសមុទ្រ' },
  'Rice': { en: 'Rice', km: 'អង្ករសម្រិត' },
  'Shrimp': { en: 'Shrimp', km: 'បង្គាស្រស់' },
  'Eggs': { en: 'Eggs', km: 'ពងមាន់' },
  'Green Beans': { en: 'Green Beans', km: 'សណ្តែកកួរ' },
  'Carrots': { en: 'Carrots', km: 'ការ៉ុត' },
  'Avocado': { en: 'Avocado', km: 'ផ្លែបឺរ' },
  'Quinoa': { en: 'Quinoa', km: 'គ្រាប់គីន័រ' },
  'Baby Spinach': { en: 'Baby Spinach', km: 'ស្ពៃពួយឡេងតូច' },
  'Citrus Dressing': { en: 'Citrus Dressing', km: 'ទឹកជ្រលក់រសជាតិក្រូចឆ្មារ' },
  'Blueberries': { en: 'Blueberries', km: 'ផ្លែប៊្លូប៊ឺរី' },
  'Strawberries': { en: 'Strawberries', km: 'ផ្លែស្រ្តប៊ឺរី' },
  'Almond Milk': { en: 'Almond Milk', km: 'ទឹកដោះគោអាល់ម៉ុន' },
  'Chia Seeds': { en: 'Chia Seeds', km: 'គ្រាប់ឈីយ៉ា' }
}

export function translateDishName(name: string): string {
  if (dishTranslations[name]) {
    return dishTranslations[name][currentLang.value].name
  }
  return name
}

export function translateDishDesc(name: string, fallback: string): string {
  if (dishTranslations[name]) {
    return dishTranslations[name][currentLang.value].desc
  }
  return fallback
}

export function translateIngredient(name: string): string {
  if (ingredientTranslations[name]) {
    return ingredientTranslations[name][currentLang.value]
  }
  return name
}

export const translations = {
  en: {
    // Brand & Roles
    brand: "GoMeal",
    ownerPortal: "Owner Portal",
    role_customer: "Customer/Guest",
    role_chef: "Chef",
    role_cashier: "Cashier",
    role_owner: "Restaurant Owner",
    
    // Auth
    welcomeBack: "Welcome Back",
    signInToContinue: "Sign in to access your GoMeal workspace.",
    registerTitle: "Create Account",
    registerSubtitle: "Join GoMeal to start smart dining and digital orders.",
    username: "Username",
    email: "Email Address",
    password: "Password",
    role: "System Role",
    usernamePlaceholder: "Enter your username",
    emailPlaceholder: "Enter your email address",
    passwordPlaceholder: "Enter your secure password",
    agreeToTerms: "I agree to the Terms of Service & Privacy Policy",
    doNotHaveAccount: "Don't have an account?",
    alreadyHaveAccount: "Already have an account?",
    regBtn: "Sign Up & Get Started",
    loginBtn: "Sign In securely",
    
    // Navigation / General
    dashboard: "Dashboard",
    analytics: "Analytics",
    settings: "Settings",
    logout: "Logout",
    table: "Table",
    switchTable: "Switch Table",
    allMenu: "All Menu",
    bakery: "Bakery",
    burger: "Burger",
    beverage: "Beverage",
    chicken: "Chicken",
    pizza: "Pizza",
    seafood: "Seafood",
    searchPlaceholder: "Search for cuisines, drinks, appetizers...",
    
    // Menu Vue (Customer Portal)
    freshSelections: "Browse our fresh selections and order directly to your table.",
    kitchenTime: "Estimated kitchen time:",
    mins: "mins",
    available: "Available",
    soldOut: "Sold Out",
    customOptions: "Customize Ingredients",
    specialInstructions: "Special Cooking Instructions",
    specialInstructionsPlaceholder: "E.g. No onion, spicy...",
    addToOrderBtn: "Add to Table Order",
    addedToOrder: "Added to Table Order",
    noItemCustomizable: "This dish doesn't have adjustable ingredients.",
    extraItemsNotice: "Custom adjustments will be made by our kitchen crew.",
    myOrdersTitle: "Table Live Order Status",
    cartTitle: "My Cart",
    cartCountSuffix: "items",
    emptyCartMessage: "No items in cart yet. Select delicious meals to begin!",
    orderStatusBanner: "Live Table Status",
    currentGuestName: "Your Dining Name",
    guestNamePlaceholder: "E.g. John Doe",
    activeTableItems: "Active Table Items",
    callWaiter: "Call Waiter",
    callingWaiter: "Calling Waiter...",
    sendOrdersBtn: "Send Orders to Chef",
    sendingOrders: "Sending to Chef...",
    settleBillBtn: "Request Bill & Pay",
    exactAmount: "Exact Payment Amount",
    exactAmountDesc: "Please scan the KHQR code below or choose static merchant QR code.",
    paymentModalTitle: "Table Digital Settlement",
    paymentModalSubtitle: "Scanning settles all active table items",
    dynamicBill: "Dynamic Bill",
    staticQr: "Static QR",
    khqrInstructions: "Open any Cambodian banking app (Bakong, ABA, ACLEDA, etc.) to scan and pay instantly.",
    doneSettleAlert: "Our cashier is processing your cash/card layout if preferred. Enjoy your day!",
    closeBtn: "Close Window",
    backToMenu: "Back to Menu",

    // Waiter status & Alerts
    waiterSuccess: "Waiter called to Table! Assistance is on the way.",
    orderSuccess: "Successfully ordered! Added to kitchen queue.",
    cookingStatusPending: "Pending Approval",
    cookingStatusPreparing: "Preparing Dish",
    cookingStatusReady: "Ready to Serve",
    cookingStatusServed: "Served Hot",

    // Chef Portal (Chef.vue)
    chefStationTitle: "Chef Kitchen Workspace",
    chefStationSubtitle: "Process incoming table tickets in real-time.",
    kitchenAlerts: "Kitchen Alerts",
    noTickets: "Kitchen is clean! No pending orders right now.",
    ticketNo: "Ticket",
    markPreparing: "Start Preparing",
    markReady: "Mark Ready to Serve",
    markServed: "Confirm Served",
    recentActivityHistory: "Recent Ticket Activity History",
    archivedItems: "items archived",
    clearHistoryBtn: "Clear Archive",
    noArchivedTickets: "No completed or served tickets archived yet.",
    itemsCount: "items",
    minutesAgo: "m ago",
    justNow: "Just now",

    // Cashier Portal (Cashier.vue)
    cashierConsoleTitle: "Cashier Settlement Portal",
    cashierConsoleSubtitle: "Review orders, split checks, and process merchant payments.",
    activeUnpaidTables: "Active Unpaid Tables",
    liveRows: "live rows",
    searchTableOrGuest: "Search table, customer name...",
    allTablesCleanTitle: "All tables are clean & paid!",
    allTablesCleanSubtitle: "Restaurant operations are fully cleared.",
    tableSettleRequest: "Settle Request",
    subtotal: "Subtotal",
    taxAndFees: "Tax & Vat (10%)",
    serviceCharge: "Service Fee (2%)",
    grandTotal: "Grand Total / Invoice",
    paymentMethod: "Payment Method",
    creditCard: "Credit Card",
    cash: "Cash Settlement",
    mobilePay: "Mobile (KHQR / QR)",
    amountReceived: "Amount Received ($)",
    changeDue: "Change Due",
    markPaidBtn: "Complete Checkout & Settle",
    voidTransactionBtn: "Void Transaction",
    viewReceiptBtn: "View Receipt",
    receiptTitle: "GoMeal Official Receipt",
    receiptWarning: "Restores bill / orders back to live table if voided.",

    // User Management
    userManagement: "User Management",
    userManagementSubtitle: "Manage staff accounts, user roles, system credentials, and account statuses.",
    addNewUser: "Add New User",
    editUser: "Edit User",
    deleteUser: "Delete User",
    resetUserPassword: "Reset Password",
    searchUsersPlaceholder: "Search by name, email, role, or phone...",
    allRoles: "All Roles",
    allStatuses: "All Statuses",
    statusActive: "Active",
    statusInactive: "Inactive",
    userRoleManager: "Manager",
    userRoleCashier: "Cashier",
    userRoleChef: "Chef",
    userRoleCustomer: "Customer",
    fullName: "Full Name",
    phoneNumber: "Phone Number",
    roleAccessLevel: "System Role & Permissions",
    newPasswordOptional: "New Password (Leave blank to keep current)",
    saveUserBtn: "Save User Details",
    createUserBtn: "Create User Account",
    updatingUser: "Saving changes...",
    creatingUser: "Creating account...",
    confirmDeleteTitle: "Confirm User Deletion",
    confirmDeleteMsg: "Are you sure you want to permanently delete this user account? This action cannot be undone.",
    deleteActionBtn: "Delete Account",
    cancelBtn: "Cancel",
    totalUsersCount: "Total Users",
    activeStaffCount: "Active Staff",
    inactiveUsersCount: "Inactive Accounts",
    lastLoginLabel: "Last Login",
    registeredOn: "Registered",
    noUsersFoundTitle: "No users matching your filter",
    noUsersFoundDesc: "Try adjusting your search query or role filter to find accounts.",
    userCreatedSuccess: "User created successfully!",
    userUpdatedSuccess: "User profile updated successfully!",
    userDeletedSuccess: "User account deleted successfully!",
    userStatusToggledSuccess: "User status updated successfully!",
    passwordResetSuccess: "User password reset successfully!"
  },
  km: {
    // Brand & Roles
    brand: "GoMeal",
    ownerPortal: "ផ្ទាំងគ្រប់គ្រងម្ចាស់ហាង",
    role_customer: "អតិថិជន / ភ្ញៀវ",
    role_chef: "ចុងភៅ",
    role_cashier: "បេឡាករ",
    role_owner: "ម្ចាស់ភោជនីយដ្ឋាន",
    
    // Auth
    welcomeBack: "សូមស្វាគមន៍ត្រឡប់មកវិញ",
    signInToContinue: "សូមចូលគណនីរបស់អ្នកដើម្បីបន្តប្រើប្រាស់ GoMeal។",
    registerTitle: "បង្កើតគណនីថ្មី",
    registerSubtitle: "ចូលរួមជាមួយ GoMeal ដើម្បីចាប់ផ្តើមកុម្ម៉ង់អាហារឌីជីថលឆ្លាតវៃ។",
    username: "ឈ្មោះអ្នកប្រើប្រាស់",
    email: "អាសយដ្ឋានអ៊ីមែល",
    password: "ពាក្យសម្ងាត់",
    role: "តួនាទីក្នុងប្រព័ន្ធ",
    usernamePlaceholder: "បញ្ចូលឈ្មោះអ្នកប្រើប្រាស់របស់អ្នក",
    emailPlaceholder: "បញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក",
    passwordPlaceholder: "បញ្ចូលពាក្យសម្ងាត់សុវត្ថិភាព",
    agreeToTerms: "ខ្ញុំយល់ព្រមតាម លក្ខខណ្ឌសេវាកម្ម និង គោលការណ៍ឯកជនភាព",
    doNotHaveAccount: "មិនទាន់មានគណនីមែនទេ?",
    alreadyHaveAccount: "មានគណនីរួចហើយមែនទេ?",
    regBtn: "ចុះឈ្មោះ និងចាប់ផ្តើមប្រើប្រាស់",
    loginBtn: "ចូលគណនីដោយសុវត្ថិភាព",
    
    // Navigation / General
    dashboard: "ផ្ទាំងគ្រប់គ្រង",
    analytics: "ការវិភាគទិន្នន័យ",
    settings: "ការកំណត់",
    logout: "ចាកចេញ",
    table: "តុលេខ",
    switchTable: "ផ្លាស់ប្តូរតុ",
    allMenu: "មុខម្ហូបទាំងអស់",
    bakery: "នំបុ័ង និងនំខេក",
    burger: "ប៊ឺហ្គឺ",
    beverage: "ភេសជ្ជៈ",
    chicken: "សាច់មាន់",
    pizza: "ភីហ្សា",
    seafood: "អាហារសមុទ្រ",
    searchPlaceholder: "ស្វែងរកមុខម្ហូប ភេសជ្ជៈ ឬអាហារសម្រន់...",
    
    // Menu Vue (Customer Portal)
    freshSelections: "ស្វែងរកមុខម្ហូបស្រស់ៗរបស់យើង និងកុម្ម៉ង់ផ្ទាល់ទៅកាន់តុរបស់អ្នក។",
    kitchenTime: "រយៈពេលចម្អិនប៉ាន់ស្មាន៖",
    mins: "នាទី",
    available: "មានលក់",
    soldOut: "អស់ហើយ",
    customOptions: "បន្ថែម/បន្ថយគ្រឿងផ្សំ",
    specialInstructions: "ការណែនាំបន្ថែមទៅកាន់ចុងភៅ",
    specialInstructionsPlaceholder: "ឧទាហរណ៍៖ មិនដាក់ខ្ទឹមបារាំង ហឹរខ្លាំង...",
    addToOrderBtn: "បន្ថែមទៅកន្ត្រកកម្ម៉ង់",
    addedToOrder: "បានបន្ថែមទៅកន្ត្រកកម្ម៉ង់",
    noItemCustomizable: "មុខម្ហូបនេះមិនមានគ្រឿងផ្សំដែលអាចកែប្រែបានឡើយ។",
    extraItemsNotice: "ការកែសម្រួលគ្រឿងផ្សំនឹងត្រូវបានរៀបចំឡើងដោយចុងភៅរបស់យើង។",
    myOrdersTitle: "ស្ថានភាពកម្ម៉ង់តុរបស់អ្នក",
    cartTitle: "កន្ត្រករបស់ខ្ញុំ",
    cartCountSuffix: "មុខ",
    emptyCartMessage: "មិនទាន់មានមុខម្ហូបក្នុងកន្ត្រកនៅឡើយ។ សូមជ្រើសរើសម្ហូបឆ្ងាញ់ៗដើម្បីចាប់ផ្តើម!",
    orderStatusBanner: "ស្ថានភាពកម្ម៉ង់ផ្ទាល់",
    currentGuestName: "ឈ្មោះរបស់អ្នកកុម្ម៉ង់",
    guestNamePlaceholder: "ឧទាហរណ៍៖ សុភី",
    activeTableItems: "មុខម្ហូបដែលបានកុម្ម៉ង់សកម្ម",
    callWaiter: "ហៅអ្នកបម្រើ",
    callingWaiter: "កំពុងហៅអ្នកបម្រើ...",
    sendOrdersBtn: "បញ្ជូនការកម្ម៉ង់ទៅចុងភៅ",
    sendingOrders: "កំពុងបញ្ជូនទៅចុងភៅ...",
    settleBillBtn: "ស្នើសុំគិតលុយ និងទូទាត់",
    exactAmount: "ចំនួនទឹកប្រាក់ត្រូវទូទាត់ជាក់ស្តែង",
    exactAmountDesc: "សូមស្កែនកូដ KHQR ខាងក្រោម ឬជ្រើសរើសកូដ QR របស់ហាងដើម្បីទូទាត់ប្រាក់។",
    paymentModalTitle: "ការទូទាត់ប្រាក់ឌីជីថលសម្រាប់តុ",
    paymentModalSubtitle: "ការស្កែននេះនឹងទូទាត់រាល់មុខម្ហូបដែលបានកុម្ម៉ង់ទាំងអស់",
    dynamicBill: "វិក្កយបត្រស្វ័យប្រវត្ត",
    staticQr: "កូដ QR ហាង",
    khqrInstructions: "បើកកម្មវិធីធនាគារកម្ពុំណាមួយ (បាគង, ABA, Acleda, ... ) ដើម្បីស្កែន និងទូទាត់ប្រាក់ភ្លាមៗ។",
    doneSettleAlert: "បេឡាកររបស់យើងអាចរៀបចំការទូទាត់ជាសាច់ប្រាក់ ឬកាតជូនលោកអ្នកផងដែរ។ សូមរីករាយជាមួយអាហាររបស់អ្នក!",
    closeBtn: "បិទផ្ទាំង",
    backToMenu: "ត្រឡប់ទៅទំព័រមុខម្ហូប",

    // Waiter status & Alerts
    waiterSuccess: "បានហៅអ្នកបម្រើ! ពួកយើងនឹងទៅជួយលោកអ្នកភ្លាមៗ។",
    orderSuccess: "ការកុម្ម៉ង់បានជោគជ័យ! បានបញ្ជូនទៅកាន់ផ្ទះបាយហើយ។",
    cookingStatusPending: "រង់ចាំការអនុម័ត",
    cookingStatusPreparing: "កំពុងចម្អិនម្ហូប",
    cookingStatusReady: "រួចរាល់សម្រាប់បម្រើ",
    cookingStatusServed: "បានបម្រើជូនក្តៅៗ",

    // Chef Portal (Chef.vue)
    chefStationTitle: "កន្លែងការងារចុងភៅ",
    chefStationSubtitle: "គ្រប់គ្រងសំបុត្រកម្ម៉ង់ដែលចូលមកក្នុងពេលជាក់ស្តែង។",
    kitchenAlerts: "ការជូនដំណឹងក្នុងផ្ទះបាយ",
    noTickets: "ផ្ទះបាយទំនេរស្អាត! គ្មានសំបុត្រកម្ម៉ង់កំពុងរង់ចាំឡើយនៅពេលនេះ។",
    ticketNo: "លេខសំបុត្រ",
    markPreparing: "ចាប់ផ្តើមចម្អិន",
    markReady: "រៀបចំរួចរាល់សម្រាប់បម្រើ",
    markServed: "បញ្ជាក់ថាបានបម្រើ",
    recentActivityHistory: "ប្រវត្តិសកម្មភាពសំបុត្រកម្ម៉ង់ថ្មីៗ",
    archivedItems: "មុខទិន្នន័យបានរក្សាទុក",
    clearHistoryBtn: "សម្អាតប្រវត្តិទុក",
    noArchivedTickets: "មិនទាន់មានសំបុត្រកម្ម៉ង់ដែលបានបញ្ចប់ ឬបម្រើរួចនៅឡើយទេ។",
    itemsCount: "មុខ",
    minutesAgo: "នាទីមុន",
    justNow: "ទើបតែឥឡូវនេះ",

    // Cashier Portal (Cashier.vue)
    cashierConsoleTitle: "ប្រព័ន្ធគ្រប់គ្រងការទូទាត់ប្រាក់បេឡា",
    cashierConsoleSubtitle: "ពិនិត្យវិក្កយបត្រ បំបែកការទូទាត់ និងដំណើរការទូទាត់ប្រាក់របស់ហាង។",
    activeUnpaidTables: "តុសកម្មមិនទាន់ទូទាត់ប្រាក់",
    liveRows: "តុសកម្ម",
    searchTableOrGuest: "ស្វែងរកតាមលេខតុ ឈ្មោះអតិថិជន...",
    allTablesCleanTitle: "តុទាំងអស់ត្រូវបានសម្អាត និងទូទាត់រួចរាល់!",
    allTablesCleanSubtitle: "ប្រតិបត្តិការភោជនីយដ្ឋានទាំងមូលត្រូវបានទូទាត់ស្អាត។",
    tableSettleRequest: "ការស្នើសុំគិតលុយ",
    subtotal: "តម្លៃសរុបដើម",
    taxAndFees: "ពន្ធ និងអាករ (10%)",
    serviceCharge: "សេវាសេវាកម្ម (2%)",
    grandTotal: "ទឹកប្រាក់សរុបចុងក្រោយ / វិក្កយបត្រ",
    paymentMethod: "វិធីសាស្ត្រទូទាត់",
    creditCard: "កាតឥណទាន (Credit Card)",
    cash: "ទូទាត់ជាសាច់ប្រាក់សុទ្ធ",
    mobilePay: "ទូទាត់តាមទូរស័ព្ទ (KHQR / QR)",
    amountReceived: "ទឹកប្រាក់ទទួលបាន ($)",
    changeDue: "ប្រាក់អាប់",
    markPaidBtn: "បញ្ចប់ការគិតលុយ និងទូទាត់",
    voidTransactionBtn: "លុបចោលប្រតិបត្តិការ",
    viewReceiptBtn: "មើលវិក្កយបត្រ",
    receiptTitle: "វិក្កយបត្រផ្លូវការ GoMeal",
    receiptWarning: "ការលុបចោលនឹងស្ដារការកម្ម៉ង់/វិក្កយបត្រត្រឡប់ទៅកាន់តុសកម្ដវិញ។",

    // User Management
    userManagement: "ការគ្រប់គ្រងអ្នកប្រើប្រាស់",
    userManagementSubtitle: "គ្រប់គ្រងគណនីបុគ្គលិក តួនាទីអ្នកប្រើប្រាស់ លិខិតសម្គាល់ និងស្ថានភាពគណនីក្នុងប្រព័ន្ធ។",
    addNewUser: "បន្ថែមអ្នកប្រើប្រាស់ថ្មី",
    editUser: "កែប្រែព័ត៌មាន",
    deleteUser: "លុបគណនី",
    resetUserPassword: "កំណត់ពាក្យសម្ងាត់ឡើងវិញ",
    searchUsersPlaceholder: "ស្វែងរកតាមឈ្មោះ អ៊ីមែល តួនាទី ឬលេខទូរស័ព្ទ...",
    allRoles: "តួនាទីទាំងអស់",
    allStatuses: "ស្ថានភាពទាំងអស់",
    statusActive: "សកម្ម",
    statusInactive: "អសកម្ម",
    userRoleManager: "អ្នកគ្រប់គ្រង (Manager)",
    userRoleCashier: "បេឡាករ (Cashier)",
    userRoleChef: "ចុងភៅ (Chef)",
    userRoleCustomer: "អតិថិជន (Customer)",
    fullName: "ឈ្មោះពេញ",
    phoneNumber: "លេខទូរស័ព្ទ",
    roleAccessLevel: "តួនាទី និងសិទ្ធិប្រើប្រាស់ក្នុងប្រព័ន្ធ",
    newPasswordOptional: "ពាក្យសម្ងាត់ថ្មី (ទុកនៅទំនេរប្រសិនបើមិនចង់ប្តូរ)",
    saveUserBtn: "រក្សាទុកការកែប្រែ",
    createUserBtn: "បង្កើតគណនីថ្មី",
    updatingUser: "កំពុងរក្សាទុក...",
    creatingUser: "កំពុងបង្កើតគណនី...",
    confirmDeleteTitle: "បញ្ជាក់ការលុបគណនីអ្នកប្រើប្រាស់",
    confirmDeleteMsg: "តើលោកអ្នកពិតជាចង់លុបគណនីអ្នកប្រើប្រាស់នេះជាអចិន្ត្រៃយ៍មែនទេ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។",
    deleteActionBtn: "លុបគណនីចោល",
    cancelBtn: "បោះបង់",
    totalUsersCount: "អ្នកប្រើប្រាស់សរុប",
    activeStaffCount: "បុគ្គលិកសកម្ម",
    inactiveUsersCount: "គណនីអសកម្ម",
    lastLoginLabel: "ចូលចុងក្រោយ",
    registeredOn: "ថ្ងៃចុះឈ្មោះ",
    noUsersFoundTitle: "រកមិនឃើញគណនីដែលត្រូវគ្នានឹងការស្វែងរកឡើយ",
    noUsersFoundDesc: "សូមសាកល្បងផ្លាស់ប្តូរពាក្យស្វែងរក ឬតម្រងតួនាទីដើម្បីស្វែងរកគណនីឡើងវិញ។",
    userCreatedSuccess: "បានបង្កើតគណនីអ្នកប្រើប្រាស់ដោយជោគជ័យ!",
    userUpdatedSuccess: "បានកែប្រែព័ត៌មានអ្នកប្រើប្រាស់ដោយជោគជ័យ!",
    userDeletedSuccess: "បានលុបគណនីអ្នកប្រើប្រាស់ដោយជោគជ័យ!",
    userStatusToggledSuccess: "បានផ្លាស់ប្តូរស្ថានភាពគណនីដោយជោគជ័យ!",
    passwordResetSuccess: "បានកំណត់ពាក្យសម្ងាត់ថ្មីដោយជោគជ័យ!"
  }
} as const
