
const DB = {
  // LocalStorage Keys
  KEYS: {
    PRODUCTS: 'pos_products',
    SALES: 'pos_sales',
    PURCHASES: 'pos_purchases',
    SUPPLIERS: 'pos_suppliers',
    CUSTOMERS: 'pos_customers',
    EXPENSES: 'pos_expenses',
    CATEGORIES: 'pos_categories',
    SETTINGS: 'pos_settings',
    USER: 'pos_user',
    INITIALIZED: 'pos_initialized'
  },

  // Helper to load from LocalStorage
  load: (key, defaultVal = []) => JSON.parse(localStorage.getItem(key)) || defaultVal,
  // Helper to save to LocalStorage
  save: (key, data) => localStorage.setItem(key, JSON.stringify(data)),

  // Products
  getProducts: async () => {
    const products = DB.load(DB.KEYS.PRODUCTS, null);
    const isInitialized = localStorage.getItem(DB.KEYS.INITIALIZED);
    
    // Only load initial data if system is NOT initialized AND initialProducts exists
    if (!isInitialized && products === null && typeof initialProducts !== 'undefined') {
      DB.save(DB.KEYS.PRODUCTS, initialProducts);
      localStorage.setItem(DB.KEYS.INITIALIZED, 'true');
      return initialProducts;
    }
    
    // Mark as initialized if products exist
    if (!isInitialized && products !== null) {
      localStorage.setItem(DB.KEYS.INITIALIZED, 'true');
    }
    
    // Return empty array if no products exist
    return products || [];
  },
  saveProducts: async (products) => {
    let list = await DB.getProducts();
    let maxId = list.length > 0 ? Math.max(...list.map(p => p.id || 0)) : 0;
    
    products.forEach(newP => {
        const idx = list.findIndex(p => p.name === newP.name);
        if (idx > -1) {
            // Update existing product but keep the ID
            list[idx] = { ...list[idx], ...newP, id: list[idx].id };
        } else {
            // Add new product with incremented ID
            maxId++;
            newP.id = maxId;
            list.push(newP);
        }
    });
    DB.save(DB.KEYS.PRODUCTS, list);
    return list;
  },
  saveProduct: async (product) => {
    const list = await DB.getProducts();
    if (product.id) {
        const idx = list.findIndex(p => p.id === product.id);
        if (idx > -1) list[idx] = product;
    } else {
        product.id = Date.now();
        list.push(product);
    }
    DB.save(DB.KEYS.PRODUCTS, list);
    return { id: product.id };
  },
  deleteProduct: async (id) => {
    const list = await DB.getProducts();
    DB.save(DB.KEYS.PRODUCTS, list.filter(p => p.id !== id));
  },

  // Sales
  getSales: async () => DB.load(DB.KEYS.SALES),
  saveSale: async (sale) => {
    const list = await DB.getSales();
    sale.id = Date.now();
    list.push(sale);
    DB.save(DB.KEYS.SALES, list);
    
    // Update stock locally
    const products = await DB.getProducts();
    sale.items.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) p.stock -= item.quantity;
    });
    DB.save(DB.KEYS.PRODUCTS, products);
    return { id: sale.id };
  },

  // Suppliers
  getSuppliers: async () => DB.load(DB.KEYS.SUPPLIERS),
  saveSupplier: async (data) => {
    const list = await DB.getSuppliers();
    if (data.id) {
        const idx = list.findIndex(s => s.id === data.id);
        if (idx > -1) list[idx] = data;
    } else {
        data.id = Date.now();
        list.push(data);
    }
    DB.save(DB.KEYS.SUPPLIERS, list);
  },
  deleteSupplier: async (id) => {
    const list = await DB.getSuppliers();
    DB.save(DB.KEYS.SUPPLIERS, list.filter(s => s.id !== id));
  },

  // Purchases
  getPurchases: async () => DB.load(DB.KEYS.PURCHASES),
  savePurchase: async (data) => {
    const list = await DB.getPurchases();
    data.id = Date.now();
    list.push(data);
    DB.save(DB.KEYS.PURCHASES, list);
    
    // Update stock automatically when purchase is saved
    const products = await DB.getProducts();
    data.items.forEach(item => {
        const p = products.find(prod => prod.id === item.id);
        if (p) {
            p.stock = (p.stock || 0) + item.quantity;
            p.purchasePrice = item.purchasePrice; // Update purchase price
        }
    });
    DB.save(DB.KEYS.PRODUCTS, products);
    
    // Update supplier balance
    const suppliers = await DB.getSuppliers();
    const supplier = suppliers.find(s => s.id === data.supplierId);
    if (supplier) {
        supplier.balance = (supplier.balance || 0) + data.remaining;
        DB.save(DB.KEYS.SUPPLIERS, suppliers);
    }
    
    return { id: data.id };
  },
  updatePurchase: async (data) => {
    const list = await DB.getPurchases();
    const idx = list.findIndex(p => p.id === data.id);
    if (idx > -1) {
        const oldRemaining = list[idx].remaining;
        list[idx] = data;
        DB.save(DB.KEYS.PURCHASES, list);
        
        // Update supplier balance
        const suppliers = await DB.getSuppliers();
        const supplier = suppliers.find(s => s.id === data.supplierId);
        if (supplier) {
            supplier.balance = (supplier.balance || 0) - (oldRemaining - data.remaining);
            DB.save(DB.KEYS.SUPPLIERS, suppliers);
        }
    }
  },
  deletePurchase: async (id) => {
    const list = await DB.getPurchases();
    const purchase = list.find(p => p.id === id);
    if (purchase) {
        // Revert stock
        const products = await DB.getProducts();
        purchase.items.forEach(item => {
            const p = products.find(prod => prod.id === item.id);
            if (p) p.stock = (p.stock || 0) - item.quantity;
        });
        DB.save(DB.KEYS.PRODUCTS, products);
        
        // Update supplier balance
        const suppliers = await DB.getSuppliers();
        const supplier = suppliers.find(s => s.id === purchase.supplierId);
        if (supplier) {
            supplier.balance = (supplier.balance || 0) - purchase.remaining;
            DB.save(DB.KEYS.SUPPLIERS, suppliers);
        }
    }
    DB.save(DB.KEYS.PURCHASES, list.filter(p => p.id !== id));
  },

  // Customers
  getCustomers: async () => DB.load(DB.KEYS.CUSTOMERS),
  saveCustomer: async (data) => {
    const list = await DB.getCustomers();
    if (data.id) {
        const idx = list.findIndex(c => c.id === data.id);
        if (idx > -1) list[idx] = data;
    } else {
        data.id = Date.now();
        list.push(data);
    }
    DB.save(DB.KEYS.CUSTOMERS, list);
  },

  // Expenses
  getExpenses: async () => DB.load(DB.KEYS.EXPENSES),
  saveExpense: async (data) => {
    const list = await DB.getExpenses();
    data.id = Date.now();
    list.push(data);
    DB.save(DB.KEYS.EXPENSES, list);
  },
  deleteExpense: async (id) => {
    const list = await DB.getExpenses();
    DB.save(DB.KEYS.EXPENSES, list.filter(e => e.id !== id));
  },

  // Categories
  getCategories: async () => DB.load(DB.KEYS.CATEGORIES, ["مواسير", "خلاطات", "محابس", "وصلات", "أخرى"]),
  saveCategories: async (data) => DB.save(DB.KEYS.CATEGORIES, data),

  // Settings & Auth
  getSettings: () => DB.load(DB.KEYS.SETTINGS, { 
    taxRate: 0, 
    currency: 'ج.م', 
    storeName: 'أولاد الخواص',
    storeArabicName: 'أولاد الخواص',
    management: 'المعلم صبري الخواص و الولادة',
    phone1: '01154031550',
    phone2: '01500272762'
  }),
  saveSettings: (data) => DB.save(DB.KEYS.SETTINGS, data),

  getCurrentUser: () => JSON.parse(sessionStorage.getItem(DB.KEYS.USER)) || null,
  setCurrentUser: (user) => sessionStorage.setItem(DB.KEYS.USER, JSON.stringify(user)),
  logout: () => { sessionStorage.removeItem(DB.KEYS.USER); location.href = 'login.html'; },

  // System
  init: () => {
    if (!document.getElementById('toast-container')) {
        const container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    
    // Scroll buttons
    if (!document.getElementById('scrollButtons')) {
        const wrapper = document.createElement('div');
        wrapper.id = 'scrollButtons';
        wrapper.style.cssText = 'position:fixed; bottom:20px; left:20px; z-index:999; display:none; flex-direction:column; gap:10px;';
        
        const btnUp = document.createElement('button');
        btnUp.id = 'scrollToTop';
        btnUp.className = 'btn';
        btnUp.innerHTML = '<i class="fas fa-chevron-up"></i>';
        btnUp.style.cssText = 'border-radius:50%; width:45px; height:45px; background:var(--primary-color); color:white; border:none; box-shadow:0 10px 15px rgba(0,0,0,0.3); cursor:pointer;';
        
        const btnDown = document.createElement('button');
        btnDown.id = 'scrollToBottom';
        btnDown.className = 'btn';
        btnDown.innerHTML = '<i class="fas fa-chevron-down"></i>';
        btnDown.style.cssText = 'border-radius:50%; width:45px; height:45px; background:var(--secondary-color); color:white; border:none; box-shadow:0 10px 15px rgba(0,0,0,0.3); cursor:pointer;';
        
        wrapper.appendChild(btnUp);
        wrapper.appendChild(btnDown);
        document.body.appendChild(wrapper);
        
        btnUp.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
        btnDown.onclick = () => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });

        window.addEventListener('scroll', () => {
            const isScrollable = document.body.scrollHeight > window.innerHeight + 100;
            if (!isScrollable) {
                wrapper.style.display = 'none';
                return;
            }
            wrapper.style.display = 'flex';
            btnUp.style.opacity = window.scrollY > 200 ? '1' : '0.3';
            btnDown.style.opacity = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200 ? '0.3' : '1';
        });
    }

    // Low stock warning badge
    setTimeout(async () => {
        const products = await DB.getProducts();
        const lowStockProducts = products.filter(p => p.stock < 10);
        const badge = document.getElementById('lowStockBadge');
        if (badge && lowStockProducts.length > 0) {
            badge.innerText = lowStockProducts.length;
            badge.style.display = 'flex';
        }
    }, 1000);
  },

  backup: async () => {
    const data = {};
    for (const key in DB.KEYS) {
        data[key] = DB.load(DB.KEYS[key]);
    }
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${new Date().toLocaleDateString()}.json`;
    a.click();
  },

  restore: async (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            for (const key in data) {
                // Use the actual localStorage key, not the KEYS constant name
                const storageKey = DB.KEYS[key] || key;
                localStorage.setItem(storageKey, JSON.stringify(data[key]));
            }
            // Mark system as initialized after restore
            localStorage.setItem(DB.KEYS.INITIALIZED, 'true');
            alert('تم استعادة البيانات بنجاح، سيتم إعادة تحميل الصفحة.');
            location.reload();
        } catch (err) {
            console.error('Restore error:', err);
            alert('خطأ في ملف النسخة الاحتياطية!');
        }
    };
    reader.readAsText(file);
  },

  showLowStockModal: async () => {
    const listProducts = (await DB.getProducts()).filter(p => p.stock < 10);
    if (listProducts.length === 0) {
        DB.showToast('لا توجد نواقص في المخزن حالياً');
        return;
    }

    let list = `
    <div id="lowStockList" style="max-height: 400px; overflow-y: auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
            <thead>
                <tr style="border-bottom:2px solid var(--primary-color); color:var(--primary-color);">
                    <th style="padding:12px; text-align:right;">اسم الصنف</th>
                    <th style="padding:12px; text-align:center;">الكمية</th>
                </tr>
            </thead>
            <tbody>
                ${listProducts.map(p => `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:12px;">${p.name}</td>
                    <td style="padding:12px; text-align:center; color:var(--danger); font-weight:bold;">${p.stock}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>
    <button class="btn btn-primary" onclick="window.print()" style="width:100%; margin-top:1rem;">
        <i class="fas fa-print"></i> طباعة النواقص
    </button>`;
    
    await DB.confirm(list, 'أصناف النواقص');
  },

  showToast: (msg, type = 'success') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
  },

  confirm: (msg, title = 'تأكيد') => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">${title}</div>
                <div class="modal-body">${msg}</div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="modal-yes">تأكيد</button>
                    <button class="btn btn-danger" id="modal-no">إلغاء</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('modal-yes').onclick = () => { overlay.remove(); resolve(true); };
        document.getElementById('modal-no').onclick = () => { overlay.remove(); resolve(false); };
    });
  },

  prompt: (msg, title = 'إدخال', defaultValue = '') => {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = `
            <div class="modal-card">
                <div class="modal-header">${title}</div>
                <div class="modal-body">
                    <p>${msg}</p>
                    <input type="text" id="modal-input" value="${defaultValue}" style="margin-top:1rem;">
                </div>
                <div class="modal-footer">
                    <button class="btn btn-primary" id="modal-ok">موافق</button>
                    <button class="btn btn-danger" id="modal-cancel">إلغاء</button>
                </div>
            </div>`;
        document.body.appendChild(overlay);
        const input = document.getElementById('modal-input');
        input.focus();
        document.getElementById('modal-ok').onclick = () => { const val = input.value; overlay.remove(); resolve(val); };
        document.getElementById('modal-cancel').onclick = () => { overlay.remove(); resolve(null); };
    });
  },

  checkAuth: () => {
    const user = DB.getCurrentUser();
    if (!user && !location.href.includes('login.html')) location.href = 'login.html';
    return user;
  },

  exportToExcel: (data, filename) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
  },

  importFromExcel: (file, callback) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
      callback(data);
    };
    reader.readAsArrayBuffer(file);
  },

  toggleMenu: () => {
    document.querySelector('.nav-links').classList.toggle('active');
    document.querySelector('.nav-overlay').classList.toggle('active');
  }
};

DB.init();
