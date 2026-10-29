/* ============================================
   Kasir Pro - Aplikasi Kasir (PWA)
   Data tersimpan aman di IndexedDB + LocalStorage
   sehingga produk TIDAK hilang saat HP mati/restart
   ============================================ */

// ===== STATE =====
let state = {
  products: [],
  transactions: [],
  settings: {
    storeName: 'Toko Saya',
    storeAddress: '',
    storePhone: '',
    taxRate: 0,
    taxEnabled: false
  },
  cart: [],
  currentCategory: 'all',
  searchTerm: '',
  productSearchTerm: ''
};

const STORAGE_KEYS = {
  products: 'kasirpro_products',
  transactions: 'kasirpro_transactions',
  settings: 'kasirpro_settings'
};

// ===== FORMAT CURRENCY =====
function formatCurrency(amount) {
  return 'Rp ' + Number(amount || 0).toLocaleString('id-ID');
}

// ===== STORAGE (IndexedDB + LocalStorage backup) =====
// Menggunakan IndexedDB agar data tahan lama dan tidak hilang saat HP mati.
// Data juga dicadangkan ke LocalStorage sebagai fallback.

const DB_NAME = 'kasirpro_db';
const DB_VERSION = 1;
let dbInstance = null;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB tidak didukung'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('products')) {
        db.createObjectStore('products', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => {
      dbInstance = req.result;
      resolve(dbInstance);
    };
    req.onerror = () => reject(req.error);
  });
}

function idbSetAll() {
  return new Promise((resolve) => {
    if (!dbInstance) return resolve();
    const tx = dbInstance.transaction(['products', 'transactions', 'settings'], 'readwrite');
    const pStore = tx.objectStore('products');
    const tStore = tx.objectStore('transactions');
    const sStore = tx.objectStore('settings');
    // Bersihkan object store products dulu agar data yang dihapus dari state
    // tidak "muncul kembali" saat aplikasi dimuat ulang dari IndexedDB.
    pStore.clear();
    state.products.forEach(p => pStore.put(p));
    state.transactions.forEach(t => tStore.put(t));
    sStore.put({ key: 'store_data', value: state.settings });
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

function idbGetAll() {
  return new Promise((resolve) => {
    if (!dbInstance) return resolve({ products: null, transactions: null, settings: null });
    const tx = dbInstance.transaction(['products', 'transactions', 'settings'], 'readonly');
    const pReq = tx.objectStore('products').getAll();
    const tReq = tx.objectStore('transactions').getAll();
    const sReq = tx.objectStore('settings').get('store_data');
    let products = null, transactions = null, settings = null;
    pReq.onsuccess = () => products = pReq.result;
    tReq.onsuccess = () => transactions = tReq.result;
    sReq.onsuccess = () => settings = sReq.result ? sReq.result.value : null;
    tx.oncomplete = () => resolve({ products, transactions, settings });
  });
}

function idbClearAll() {
  return new Promise((resolve) => {
    if (!dbInstance) return resolve();
    const tx = dbInstance.transaction(['products', 'transactions', 'settings'], 'readwrite');
    tx.objectStore('products').clear();
    tx.objectStore('transactions').clear();
    tx.objectStore('settings').clear();
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

// Simpan data ke IndexedDB dan LocalStorage (dual backup)
function saveData() {
  localStorage.setItem(STORAGE_KEYS.products, JSON.stringify(state.products));
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
  // Kembalikan promise agar bisa di-await (memastikan penulisan IDB selesai)
  return idbSetAll();
}

// Muat data dari IndexedDB (prioritas), fallback ke LocalStorage
async function loadData() {
  try {
    // Coba buka IndexedDB
    await openDatabase();
    const idbData = await idbGetAll();
    if (idbData.products && idbData.products.length > 0) {
      state.products = idbData.products;
    } else {
      state.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products)) || [];
    }
    if (idbData.transactions && idbData.transactions.length > 0) {
      state.transactions = idbData.transactions;
    } else {
      state.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];
    }
    if (idbData.settings) {
      state.settings = Object.assign({}, state.settings, idbData.settings);
    } else {
      state.settings = Object.assign({}, state.settings, JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) || {});
    }
  } catch (e) {
    console.warn('IndexedDB gagal, pakai LocalStorage:', e);
    try {
      state.products = JSON.parse(localStorage.getItem(STORAGE_KEYS.products)) || [];
      state.transactions = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions)) || [];
      state.settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.settings)) || state.settings;
    } catch (err) {
      console.error('Gagal memuat data:', err);
    }
  }

  // Seed data jika kosong
  if (!state.products || state.products.length === 0) {
    seedProducts();
  }

  // Minta penyimpanan persisten agar data tidak dihapus browser
  requestPersistentStorage();
}

async function requestPersistentStorage() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        await navigator.storage.persist();
      }
    }
  } catch (e) {
    console.warn('Gagal meminta persistent storage:', e);
  }
}

function seedProducts() {
  state.products = [
    { id: 'p1', name: 'Beras Premium 5kg', category: 'Sembako', price: 75000, stock: 30, emoji: '🍚' },
    { id: 'p2', name: 'Minyak Goreng 1L', category: 'Sembako', price: 18000, stock: 40, emoji: '🫗' },
    { id: 'p3', name: 'Telur Ayam 1kg', category: 'Sembako', price: 28000, stock: 25, emoji: '🥚' },
    { id: 'p4', name: 'Gula Pasir 1kg', category: 'Sembako', price: 17000, stock: 50, emoji: '🍬' },
    { id: 'p5', name: 'Tepung Terigu 1kg', category: 'Sembako', price: 12000, stock: 35, emoji: '🥣' },
    { id: 'p6', name: 'Mie Instan', category: 'Sembako', price: 3500, stock: 100, emoji: '🍜' },
    { id: 'p7', name: 'Kopi Bubuk', category: 'Sembako', price: 15000, stock: 30, emoji: '☕' },
    { id: 'p8', name: 'Susu Kental Manis', category: 'Sembako', price: 12000, stock: 40, emoji: '🥛' },
    { id: 'p9', name: 'Bawang Merah', category: 'Sembako', price: 30000, stock: 20, emoji: '🧅' },
    { id: 'p10', name: 'Bawang Putih', category: 'Sembako', price: 35000, stock: 20, emoji: '🧄' }
  ];
  saveData();
}

// ===== DOM ELEMENTS =====
const $ = (id) => document.getElementById(id);

// ===== UTILITY =====
function showToast(message, type = '') {
  const toast = $('toast');
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => {
    toast.className = 'toast';
  }, 2500);
}

function showModal(id) {
  $(id).classList.add('show');
}

function hideModal(id) {
  $(id).classList.remove('show');
}

function getCategories() {
  return [...new Set(state.products.map(p => p.category))];
}

function getFilteredProducts() {
  let filtered = state.products;
  if (state.currentCategory !== 'all') {
    filtered = filtered.filter(p => p.category === state.currentCategory);
  }
  if (state.searchTerm) {
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(state.searchTerm.toLowerCase())
    );
  }
  return filtered;
}

// ===== RENDER PRODUCT GRID =====
function renderProductGrid() {
  const grid = $('productGrid');
  const products = getFilteredProducts();

  if (products.length === 0) {
    grid.innerHTML = '<div class="history-empty">Tidak ada produk ditemukan</div>';
    return;
  }

  grid.innerHTML = products.map(p => {
    const stockClass = p.stock <= 0 ? 'out' : (p.stock <= 10 ? 'low' : '');
    const lowClass = p.stock <= 0 ? 'out-stock' : (p.stock <= 10 ? 'low-stock' : '');
    const stockLabel = p.stock <= 0 ? 'Habis' : (p.stock <= 10 ? `Stok ${p.stock}` : `Stok ${p.stock}`);
    return `
      <div class="product-card ${lowClass}" data-id="${p.id}" onclick="addToCart('${p.id}')">
        <span class="emoji">${p.emoji}</span>
        <div class="name">${p.name}</div>
        <div class="price">${formatCurrency(p.price)}</div>
        <span class="stock-badge ${stockClass}">${stockLabel}</span>
      </div>
    `;
  }).join('');
}

// ===== RENDER CATEGORIES =====
function renderCategories() {
  const list = $('categoryList');
  const categories = getCategories();
  list.innerHTML = categories.map(cat => `
    <button class="btn-category ${state.currentCategory === cat ? 'active' : ''}" data-cat="${cat}" onclick="setCategory('${cat}')">
      ${cat}
    </button>
  `).join('');
}

function setCategory(cat) {
  state.currentCategory = cat;
  renderCategories();
  renderProductGrid();
}

// ===== CART =====
function addToCart(productId) {
  const product = state.products.find(p => p.id === productId);
  if (!product) return;
  if (product.stock <= 0) {
    showToast('Stok produk habis!', 'error');
    return;
  }

  const existing = state.cart.find(c => c.productId === productId);
  if (existing) {
    if (existing.qty >= product.stock) {
      showToast('Stok tidak mencukupi!', 'error');
      return;
    }
    existing.qty++;
  } else {
    state.cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      emoji: product.emoji,
      qty: 1,
      stock: product.stock
    });
  }
  renderCart();
  showToast(`${product.name} ditambahkan`, 'success');
}

function updateQty(productId, delta) {
  const item = state.cart.find(c => c.productId === productId);
  if (!item) return;

  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter(c => c.productId !== productId);
  } else {
    const product = state.products.find(p => p.id === productId);
    if (product && item.qty > product.stock) {
      item.qty = product.stock;
      showToast('Stok tidak mencukupi!', 'error');
    }
  }
  renderCart();
}

function removeFromCart(productId) {
  state.cart = state.cart.filter(c => c.productId !== productId);
  renderCart();
}

function renderCart() {
  const container = $('cartItems');
  const count = state.cart.reduce((sum, c) => sum + c.qty, 0);

  $('cartCount').textContent = count + ' item';

  if (state.cart.length === 0) {
    container.innerHTML = '<div class="cart-empty">Keranjang kosong<br>Klik produk untuk menambahkan</div>';
  } else {
    container.innerHTML = state.cart.map(item => `
      <div class="cart-item">
        <span class="item-emoji">${item.emoji}</span>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-price">${formatCurrency(item.price)}</div>
        </div>
        <div class="qty-control">
          <button class="qty-btn" onclick="updateQty('${item.productId}', -1)">−</button>
          <span class="qty">${item.qty}</span>
          <button class="qty-btn" onclick="updateQty('${item.productId}', 1)">+</button>
        </div>
        <div class="item-total">${formatCurrency(item.price * item.qty)}</div>
        <button class="item-remove" onclick="removeFromCart('${item.productId}')">×</button>
      </div>
    `).join('');
  }

  updateTotals();
}

function updateTotals() {
  const subtotal = state.cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const taxRate = state.settings.taxEnabled ? state.settings.taxRate : 0;
  const tax = subtotal * (taxRate / 100);
  const total = subtotal + tax;

  $('subtotal').textContent = formatCurrency(subtotal);
  $('grandTotal').textContent = formatCurrency(total);

  $('checkoutTotal').textContent = formatCurrency(total);
  $('checkoutTax').textContent = formatCurrency(tax);
  $('checkoutTaxRow').style.display = tax > 0 ? 'flex' : 'none';
  $('checkoutTaxRow').querySelector('span:first-child').textContent = `Pajak (${taxRate}%)`;

  $('btnCheckout').disabled = state.cart.length === 0;
}

// ===== CHECKOUT =====
let currentPaymentMethod = 'cash';
let currentTotal = 0;

function openCheckout() {
  const subtotal = state.cart.reduce((sum, c) => sum + (c.price * c.qty), 0);
  const taxRate = state.settings.taxEnabled ? state.settings.taxRate : 0;
  const tax = subtotal * (taxRate / 100);
  currentTotal = subtotal + tax;

  $('cashInputGroup').style.display = currentPaymentMethod === 'cash' ? 'block' : 'none';
  $('cashReceived').value = '';
  $('changeAmount').textContent = 'Rp 0';
  showModal('checkoutModal');
}

function selectPaymentMethod(method) {
  currentPaymentMethod = method;
  document.querySelectorAll('.payment-method').forEach(m => {
    m.classList.toggle('active', m.dataset.method === method);
  });
  $('cashInputGroup').style.display = method === 'cash' ? 'block' : 'none';
  updateChange();
}

function updateChange() {
  const cashReceived = parseFloat($('cashReceived').value) || 0;
  const change = cashReceived - currentTotal;
  $('changeAmount').textContent = change >= 0 ? formatCurrency(change) : 'Rp 0';
}

function confirmPayment() {
  if (state.cart.length === 0) {
    showToast('Keranjang masih kosong', 'error');
    return;
  }

  if (currentPaymentMethod === 'cash') {
    const cashReceived = parseFloat($('cashReceived').value) || 0;
    if (cashReceived < currentTotal) {
      showToast('Uang tidak mencukupi!', 'error');
      return;
    }
  }

  // Kurangi stok
  state.cart.forEach(item => {
    const product = state.products.find(p => p.id === item.productId);
    if (product) {
      product.stock -= item.qty;
    }
  });

  // Simpan transaksi
  const transaction = {
    id: 'TRX-' + Date.now(),
    date: new Date().toISOString(),
    items: state.cart.map(item => ({
      name: item.name,
      qty: item.qty,
      price: item.price,
      emoji: item.emoji
    })),
    subtotal: state.cart.reduce((sum, c) => sum + (c.price * c.qty), 0),
    tax: state.settings.taxEnabled ? (state.cart.reduce((sum, c) => sum + (c.price * c.qty), 0) * (state.settings.taxRate / 100)) : 0,
    total: currentTotal,
    paymentMethod: currentPaymentMethod,
    cashReceived: currentPaymentMethod === 'cash' ? (parseFloat($('cashReceived').value) || 0) : currentTotal,
    change: currentPaymentMethod === 'cash' ? ((parseFloat($('cashReceived').value) || 0) - currentTotal) : 0
  };

  state.transactions.unshift(transaction);
  saveData();

  hideModal('checkoutModal');
  renderReceipt(transaction);
  showModal('receiptModal');

  state.cart = [];
  renderCart();
  renderProductGrid();
  renderProductsTable();
}

// ===== RECEIPT =====
let currentReceiptTransaction = null;
let connectedPrinterAddress = null;

function renderReceipt(tx) {
  currentReceiptTransaction = tx;
  const store = state.settings;
  const html = `
    <div class="receipt-header">
      <h3>${store.storeName}</h3>
      ${store.storeAddress ? `<div>${store.storeAddress}</div>` : ''}
      ${store.storePhone ? `<div>Tel: ${store.storePhone}</div>` : ''}
      <div>${new Date(tx.date).toLocaleDateString('id-ID')} ${new Date(tx.date).toLocaleTimeString('id-ID')}</div>
      <div>${tx.id}</div>
    </div>
    <div class="receipt-line"></div>
    ${tx.items.map(item => `
      <div class="receipt-item">
        <div>${item.name}</div>
        <div class="receipt-row">
          <span>${item.qty} x ${formatCurrency(item.price)}</span>
          <span>${formatCurrency(item.price * item.qty)}</span>
        </div>
      </div>
    `).join('')}
    <div class="receipt-line"></div>
    <div class="receipt-row"><span>Subtotal</span><span>${formatCurrency(tx.subtotal)}</span></div>
    ${tx.tax > 0 ? `<div class="receipt-row"><span>Pajak</span><span>${formatCurrency(tx.tax)}</span></div>` : ''}
    <div class="receipt-row"><strong>TOTAL</strong><strong>${formatCurrency(tx.total)}</strong></div>
    <div class="receipt-line"></div>
    <div class="receipt-row"><span>${tx.paymentMethod.toUpperCase()}</span><span>${formatCurrency(tx.cashReceived)}</span></div>
    <div class="receipt-row"><span>Kembalian</span><span>${formatCurrency(tx.change)}</span></div>
    <div class="receipt-footer">
      <div class="receipt-line"></div>
      <div>Terima kasih atas kunjungan Anda!</div>
      <div>Barang yang sudah dibeli tidak dapat ditukar</div>
    </div>
  `;
  $('receiptContent').innerHTML = html;
}

function formatReceiptForPrinter(tx) {
  const store = state.settings;
  const itemLines = tx.items.flatMap(item => [
    item.name,
    `${item.qty} x ${formatCurrency(item.price)}  ${formatCurrency(item.price * item.qty)}`
  ]);
  const lines = [
    store.storeName || 'Toko Saya',
    store.storeAddress,
    store.storePhone ? `Tel: ${store.storePhone}` : '',
    `${new Date(tx.date).toLocaleDateString('id-ID')} ${new Date(tx.date).toLocaleTimeString('id-ID')}`,
    tx.id,
    '--------------------------------',
    ...itemLines,
    '--------------------------------',
    `Subtotal: ${formatCurrency(tx.subtotal)}`,
    tx.tax > 0 ? `Pajak: ${formatCurrency(tx.tax)}` : '',
    `TOTAL: ${formatCurrency(tx.total)}`,
    `Pembayaran ${tx.paymentMethod.toUpperCase()}: ${formatCurrency(tx.cashReceived)}`,
    `Kembalian: ${formatCurrency(tx.change)}`,
    '',
    'Terima kasih atas kunjungan Anda!'
  ];
  return lines.filter(line => line !== '').join('\n') + '\n';
}

async function printReceiptDirectly(tx) {
  if (!connectedPrinterAddress) {
    showToast('Hubungkan printer di Pengaturan terlebih dahulu', 'error');
    switchView('settings');
    return;
  }
  try {
    await window.KasirPrinter.print(formatReceiptForPrinter(tx));
    showToast('Struk dikirim ke printer', 'success');
  } catch (error) {
    showToast(error.message || 'Gagal mencetak struk', 'error');
  }
}

async function printTestReceipt() {
  const now = new Date();
  const testReceipt = {
    id: 'TES-PRINTER',
    date: now.toISOString(),
    items: [{ name: 'Tes cetak', qty: 1, price: 1000, emoji: '🧾' }],
    subtotal: 1000,
    tax: 0,
    total: 1000,
    paymentMethod: 'tes',
    cashReceived: 1000,
    change: 0
  };

  if (window.KasirPrinter?.isNative) {
    await printReceiptDirectly(testReceipt);
    return;
  }

  renderReceipt(testReceipt);
  showModal('receiptModal');
  window.print();
}

async function loadPairedPrinters() {
  const select = $('printerDevice');
  const status = $('printerStatus');
  status.textContent = 'Memuat perangkat Bluetooth...';
  try {
    const result = await window.KasirPrinter.getPairedDevices();
    const devices = result.devices || [];
    const savedAddress = localStorage.getItem('kasirpro_printer_address');
    select.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Pilih printer';
    select.append(placeholder);
    devices.forEach(device => {
      const option = document.createElement('option');
      option.value = device.address;
      option.textContent = `${device.name} (${device.address})`;
      select.append(option);
    });
    if (devices.some(device => device.address === savedAddress)) {
      select.value = savedAddress;
    }
    status.textContent = devices.length
      ? 'Pilih MP-58A1, lalu tekan Hubungkan Printer.'
      : 'Belum ada printer dipasangkan. Pasangkan melalui Bluetooth Android.';
  } catch (error) {
    status.textContent = error.message || 'Tidak dapat memuat perangkat Bluetooth.';
  }
}

function setupPrinterSettings() {
  const isNative = Boolean(window.KasirPrinter?.isNative);
  $('nativePrinterControls').hidden = !isNative;
  $('webPrinterControls').hidden = isNative;
  if (!isNative) return;

  $('btnOpenPrinterSettings').addEventListener('click', async () => {
    try {
      await window.KasirPrinter.openBluetoothSettings();
      $('printerStatus').textContent = 'Pasangkan MP-58A1 di Android, kembali ke aplikasi, lalu tekan Muat Perangkat.';
    } catch (error) {
      showToast(error.message || 'Pengaturan Bluetooth tidak dapat dibuka', 'error');
    }
  });
  $('btnRefreshPrinters').addEventListener('click', loadPairedPrinters);
  $('btnConnectPrinter').addEventListener('click', async () => {
    const address = $('printerDevice').value;
    if (!address) {
      showToast('Pilih printer yang sudah dipasangkan', 'error');
      return;
    }
    $('printerStatus').textContent = 'Menghubungkan ke printer...';
    try {
      const device = await window.KasirPrinter.connect(address);
      connectedPrinterAddress = device.address;
      localStorage.setItem('kasirpro_printer_address', device.address);
      $('printerStatus').textContent = `${device.name} terhubung`;
      $('btnTestPrinter').disabled = false;
      $('btnDisconnectPrinter').disabled = false;
      showToast('Printer berhasil terhubung', 'success');
    } catch (error) {
      connectedPrinterAddress = null;
      $('printerStatus').textContent = error.message || 'Gagal menghubungkan printer.';
      $('btnTestPrinter').disabled = true;
      showToast($('printerStatus').textContent, 'error');
    }
  });
  $('btnDisconnectPrinter').addEventListener('click', async () => {
    try {
      await window.KasirPrinter.disconnect();
      connectedPrinterAddress = null;
      $('printerStatus').textContent = 'Printer terputus';
      $('btnTestPrinter').disabled = true;
      $('btnDisconnectPrinter').disabled = true;
    } catch (error) {
      showToast(error.message || 'Gagal memutus printer', 'error');
    }
  });
  $('btnTestPrinter').addEventListener('click', printTestReceipt);
  loadPairedPrinters();
}

// ===== PRODUCTS MANAGEMENT =====
function renderProductsTable() {
  const tbody = $('productsTableBody');
  const term = (state.productSearchTerm || '').toLowerCase();

  let products = state.products;
  if (term) {
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );
  }

  if (state.products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:30px">Belum ada produk</td></tr>';
    return;
  }

  if (products.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:30px">Tidak ada produk ditemukan</td></tr>';
    return;
  }

  tbody.innerHTML = products.map(p => {
    const stockClass = p.stock <= 0 ? 'out' : (p.stock <= 10 ? 'low' : '');
    return `
      <tr>
        <td>
          <div class="product-cell">
            <span class="emoji">${p.emoji}</span>
            <span>${p.name}</span>
          </div>
        </td>
        <td>${p.category}</td>
        <td>${formatCurrency(p.price)}</td>
        <td><span class="stock-cell ${stockClass}">${p.stock}</span></td>
        <td>
          <div class="table-actions">
            <button class="act-btn act-edit" onclick="openEditProduct('${p.id}')">Edit</button>
            <button class="act-btn act-del" onclick="deleteProduct('${p.id}')">Hapus</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

let editingProductId = null;
let selectedEmoji = '🍚';

const EMOJI_LIST = [
  '🍚', '🌾', '🥣', '🌽', '🥔', '🫘', '🥜', '🥥',
  '🫛', '🥦', '🥬', '🥕', '🧅', '🧄', '🌶️', '🍅',
  '🥒', '🍋', '🍊', '🍎', '🍌', '🍉', '🥭', '🍇',
  '🥚', '🍳', '🧈', '🧀', '🥛', '🍼', '🍶', '🧂',
  '🍯', '🍬', '🍫', '🍭', '🍮', '🍩', '🍪', '🍞',
  '🥖', '🥐', '🥞', '🍜', '🍝', '🍗', '🥩', '🍤',
  '🐟', '🐔', '🦐', '🦀', '☕', '🍵', '🥤', '🧃',
  '💧', '🧴', '🧼', '🧻', '🧽', '🪥', '🛒', '🧺',
  '📦', '🧾', '🏷️', '💰', '🪙', '💳'
];

function renderEmojiPicker(selected) {
  const picker = $('emojiPicker');
  picker.innerHTML = EMOJI_LIST.map(em => `
    <button type="button" class="emoji-option ${em === selected ? 'active' : ''}" data-emoji="${em}" onclick="selectEmoji(this)">
      ${em}
    </button>
  `).join('');
}

function selectEmoji(el) {
  selectedEmoji = el.dataset.emoji;
  document.querySelectorAll('.emoji-option').forEach(o => o.classList.remove('active'));
  el.classList.add('active');
}

function openAddProduct() {
  editingProductId = null;
  selectedEmoji = '🍚';
  $('productModalTitle').textContent = 'Tambah Produk';
  $('productId').value = '';
  $('productName').value = '';
  $('productCategory').value = 'Sembako';
  $('productPrice').value = '';
  $('productStock').value = '';
  renderEmojiPicker(selectedEmoji);
  showModal('productModal');
}

function openEditProduct(id) {
  const product = state.products.find(p => p.id === id);
  if (!product) return;
  editingProductId = id;
  selectedEmoji = product.emoji || '🍔';
  $('productModalTitle').textContent = 'Edit Produk';
  $('productId').value = product.id;
  $('productName').value = product.name;
  $('productCategory').value = product.category;
  $('productPrice').value = product.price;
  $('productStock').value = product.stock;
  renderEmojiPicker(selectedEmoji);
  showModal('productModal');
}

function saveProduct() {
  const name = $('productName').value.trim();
  const category = $('productCategory').value;
  const price = parseFloat($('productPrice').value) || 0;
  const stock = parseInt($('productStock').value) || 0;
  const emoji = selectedEmoji || '📦';

  if (!name) {
    showToast('Nama produk wajib diisi!', 'error');
    return;
  }
  if (price <= 0) {
    showToast('Harga harus lebih dari 0!', 'error');
    return;
  }

  if (editingProductId) {
    const product = state.products.find(p => p.id === editingProductId);
    if (product) {
      product.name = name;
      product.category = category;
      product.price = price;
      product.stock = stock;
      product.emoji = emoji;
    }
    showToast('Produk berhasil diperbarui', 'success');
  } else {
    const newProduct = {
      id: 'p' + Date.now(),
      name,
      category,
      price,
      stock,
      emoji
    };
    state.products.push(newProduct);
    showToast('Produk berhasil ditambahkan', 'success');
  }

  saveData();
  hideModal('productModal');
  renderProductGrid();
  renderCategories();
  renderProductsTable();
}

function deleteProduct(id) {
  if (!confirm('Yakin ingin menghapus produk ini?')) return;
  state.products = state.products.filter(p => p.id !== id);
  state.cart = state.cart.filter(c => c.productId !== id);
  saveData();
  renderProductGrid();
  renderCategories();
  renderProductsTable();
  renderCart();
  showToast('Produk dihapus', 'success');
}

// ===== HISTORY =====
function renderHistory() {
  const list = $('historyList');
  const filterDate = $('filterDate').value;

  let transactions = state.transactions;
  if (filterDate) {
    transactions = transactions.filter(tx => {
      return new Date(tx.date).toLocaleDateString('en-CA') === filterDate;
    });
  }

  if (transactions.length === 0) {
    list.innerHTML = `
      <div class="history-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <div>Belum ada transaksi</div>
      </div>`;
    return;
  }

  list.innerHTML = transactions.map(tx => {
    const date = new Date(tx.date);
    const itemsSummary = tx.items.map(i => `${i.name} x${i.qty}`).join(', ');
    return `
      <div class="history-card" onclick="viewReceipt('${tx.id}')">
        <div class="history-card-header">
          <span class="history-id">${tx.id}</span>
          <span class="history-date">${date.toLocaleDateString('id-ID')} ${date.toLocaleTimeString('id-ID')}</span>
        </div>
        <div class="history-items">${itemsSummary}</div>
        <div class="history-footer">
          <span class="history-total">${formatCurrency(tx.total)}</span>
          <span class="history-method">${tx.paymentMethod}</span>
        </div>
        <div class="history-view-receipt">👉 Ketuk untuk lihat struk</div>
      </div>
    `;
  }).join('');
}

// ===== VIEW RECEIPT (STRUK) =====
function viewReceipt(id) {
  const tx = state.transactions.find(t => t.id === id);
  if (!tx) {
    showToast('Transaksi tidak ditemukan', 'error');
    return;
  }
  renderReceipt(tx);
  showModal('receiptModal');
}

// ===== SETTINGS =====
function loadSettingsForm() {
  $('storeName').value = state.settings.storeName;
  $('storeAddress').value = state.settings.storeAddress;
  $('storePhone').value = state.settings.storePhone;
  $('taxRate').value = state.settings.taxRate;
  $('taxEnabled').checked = state.settings.taxEnabled;
}

function saveSettings() {
  state.settings.storeName = $('storeName').value.trim() || 'Toko Saya';
  state.settings.storeAddress = $('storeAddress').value.trim();
  state.settings.storePhone = $('storePhone').value.trim();
  state.settings.taxRate = parseFloat($('taxRate').value) || 0;
  state.settings.taxEnabled = $('taxEnabled').checked;
  saveData();
  showToast('Pengaturan disimpan', 'success');
}

async function resetAllData() {
  if (!confirm('Yakin ingin menghapus SEMUA data? Tindakan ini tidak dapat dibatalkan!')) return;
  localStorage.removeItem(STORAGE_KEYS.products);
  localStorage.removeItem(STORAGE_KEYS.transactions);
  localStorage.removeItem(STORAGE_KEYS.settings);
  try {
    await idbClearAll();
  } catch (e) {
    console.warn('Gagal bersihkan IndexedDB:', e);
  }
  // Reset state
  state.products = [];
  state.transactions = [];
  state.settings = {
    storeName: 'Toko Saya',
    storeAddress: '',
    storePhone: '',
    taxRate: 0,
    taxEnabled: false
  };
  seedProducts();
  loadSettingsForm();
  renderAll();
  showToast('Semua data direset', 'success');
}

function exportData() {
  const data = {
    settings: state.settings,
    products: state.products,
    transactions: state.transactions,
    exportedAt: new Date().toISOString()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kasir-pro-backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data berhasil diexport', 'success');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.products) state.products = data.products;
      if (data.transactions) state.transactions = data.transactions;
      if (data.settings) state.settings = Object.assign({}, state.settings, data.settings);
      await saveData();
      loadSettingsForm();
      renderAll();
      showToast('Data berhasil diimport', 'success');
    } catch (err) {
      showToast('File tidak valid!', 'error');
    }
  };
  reader.readAsText(file);
}

// ===== EXPORT TRANSACTIONS (CSV) =====
function exportTransactions() {
  if (state.transactions.length === 0) {
    showToast('Belum ada transaksi untuk diexport', 'error');
    return;
  }
  let csv = 'ID Transaksi,Tanggal,Item,Total,Metode Pembayaran\n';
  state.transactions.forEach(tx => {
    const items = tx.items.map(i => `${i.name} x${i.qty}`).join(' | ');
    csv += `"${tx.id}","${new Date(tx.date).toLocaleString('id-ID')}","${items}","${tx.total}","${tx.paymentMethod}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transaksi-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Data transaksi diexport', 'success');
}

// ===== NAVIGATION =====
function switchView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  $('view-' + viewName).classList.add('active');
  document.querySelector(`.nav-item[data-view="${viewName}"]`).classList.add('active');

  if (viewName === 'products') renderProductsTable();
  if (viewName === 'history') renderHistory();
  if (viewName === 'settings') loadSettingsForm();
}

// ===== RENDER ALL =====
function renderAll() {
  renderProductGrid();
  renderCategories();
  renderCart();
  renderProductsTable();
  renderHistory();
}

// ===== PWA INSTALL =====
let deferredPrompt = null;
let installBanner = null;

function setupInstall() {
  // Create install banner
  installBanner = document.createElement('div');
  installBanner.className = 'install-banner';
  installBanner.innerHTML = `
    <span>📱 Install Kasir Pro di perangkat Anda</span>
    <button class="install-btn">Install</button>
    <button class="close-btn">✕</button>
  `;
  document.body.appendChild(installBanner);

  installBanner.querySelector('.install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        installBanner.classList.remove('show');
        showToast('Aplikasi sedang diinstall', 'success');
      }
      deferredPrompt = null;
    }
  });

  installBanner.querySelector('.close-btn').addEventListener('click', () => {
    installBanner.classList.remove('show');
    sessionStorage.setItem('kasirpro_install_dismissed', 'true');
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (!sessionStorage.getItem('kasirpro_install_dismissed')) {
      installBanner.classList.add('show');
    }
  });

  window.addEventListener('appinstalled', () => {
    installBanner.classList.remove('show');
    showToast('Aplikasi berhasil diinstall!', 'success');
  });
}

// ===== CURRENT DATE =====
function updateDate() {
  const now = new Date();
  $('currentDate').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

// ===== STATUS ONLINE/OFFLINE =====
function updateNetworkStatus() {
  const badge = $('statusBadge');
  const text = $('statusText');
  const isOnline = navigator.onLine;

  if (isOnline) {
    badge.classList.remove('offline');
    text.textContent = 'Online';
    badge.title = 'Terhubung ke internet';
  } else {
    badge.classList.add('offline');
    text.textContent = 'Offline';
    badge.title = 'Mode offline — aplikasi tetap berfungsi!';
  }
}

function setupNetworkStatus() {
  updateNetworkStatus();
  window.addEventListener('online', () => {
    updateNetworkStatus();
    showToast('Kembali online', 'success');
  });
  window.addEventListener('offline', () => {
    updateNetworkStatus();
    showToast('Mode offline — data tetap tersimpan lokal', '');
  });
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  // Splash - hilangkan setelah data siap
  function hideSplash() {
    $('splash').classList.add('hidden');
    setTimeout(() => $('splash').style.display = 'none', 400);
  }
  setTimeout(hideSplash, 2500); // fallback jika loadData lambat

  setupInstall();
  setupPrinterSettings();
  updateDate();
  setupNetworkStatus();

  // Muat data (IndexedDB + LocalStorage) lalu render
  loadData().then(() => {
    renderAll();
    loadSettingsForm();
    if (document.querySelector('#splash').classList.contains('hidden') === false) {
      hideSplash();
    }
  }).catch(() => {
    renderAll();
    loadSettingsForm();
    hideSplash();
  });

  // ===== SEARCH =====
  $('searchInput').addEventListener('input', (e) => {
    state.searchTerm = e.target.value;
    renderProductGrid();
  });

  // ===== SEARCH PRODUK (MANAJEMEN PRODUK) =====
  $('productSearchInput').addEventListener('input', (e) => {
    state.productSearchTerm = e.target.value;
    renderProductsTable();
  });

  // ===== NAVIGATION =====
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // ===== CHECKOUT =====
  $('btnCheckout').addEventListener('click', openCheckout);
  $('closeCheckout').addEventListener('click', () => hideModal('checkoutModal'));
  $('btnConfirmPayment').addEventListener('click', confirmPayment);

  document.querySelectorAll('.payment-method').forEach(m => {
    m.addEventListener('click', () => selectPaymentMethod(m.dataset.method));
  });

  $('cashReceived').addEventListener('input', updateChange);

  // ===== RECEIPT =====
  $('closeReceipt').addEventListener('click', () => hideModal('receiptModal'));
  $('btnNewTransaction').addEventListener('click', () => {
    hideModal('receiptModal');
    switchView('pos');
    renderProductGrid();
  });
  $('btnPrintReceipt').addEventListener('click', () => {
    if (window.KasirPrinter?.isNative) {
      printReceiptDirectly(currentReceiptTransaction);
    } else {
      window.print();
    }
  });
  $('btnBrowserTestPrint').addEventListener('click', printTestReceipt);

  // ===== PRODUCT MODAL =====
  $('btnAddProduct').addEventListener('click', openAddProduct);
  $('closeProductModal').addEventListener('click', () => hideModal('productModal'));
  $('btnSaveProduct').addEventListener('click', saveProduct);

  // ===== SETTINGS =====
  $('btnSaveSettings').addEventListener('click', saveSettings);
  $('btnConnectPrinter').addEventListener('click', printTestReceipt);
  $('btnResetData').addEventListener('click', resetAllData);
  $('btnExportData').addEventListener('click', exportData);
  $('btnImportData').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
    e.target.value = '';
  });

  // ===== HISTORY EXPORT =====
  $('btnExport').addEventListener('click', exportTransactions);

  // ===== SYNC =====
  $('btnSync').addEventListener('click', async () => {
    await saveData();
    showToast('Data tersimpan aman & offline', 'success');
  });

  // ===== SETTINGS NAV =====
  $('btnSettings').addEventListener('click', () => switchView('settings'));

  // ===== MODAL CLOSE ON BACKDROP =====
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  });
});

// ===== PRINT CSS =====
const printStyle = document.createElement('style');
printStyle.textContent = `
  @media print {
    @page {
      size: 58mm auto;
      margin: 0;
    }

    html, body {
      width: 58mm;
      min-width: 58mm;
      height: auto;
      min-height: 0;
      margin: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: white;
    }

    body * { visibility: hidden; }
    #receiptModal.show, #receiptModal.show * { visibility: visible; }
    #receiptModal.show {
      display: block;
      position: absolute;
      left: 0; top: 0;
      width: 58mm;
      height: auto;
      margin: 0;
      padding: 0;
      background: white;
      overflow: visible;
    }
    #receiptModal.show .modal {
      width: 58mm;
      min-width: 58mm;
      max-width: 58mm;
      max-height: none;
      border-radius: 0;
      box-shadow: none;
      height: auto;
      overflow: visible;
    }
    #receiptModal.show .modal-body {
      padding: 0;
      overflow: visible;
    }
    #receiptModal.show .receipt-content {
      width: 58mm;
      margin: 0;
      padding: 2mm;
      border: 0;
      border-radius: 0;
      overflow: visible;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #receiptModal.show .receipt-item,
    #receiptModal.show .receipt-row {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    #receiptModal.show .modal-header,
    #receiptModal.show .modal-footer,
    #receiptModal.show .modal-close { display: none; }
  }
`;
document.head.appendChild(printStyle);
