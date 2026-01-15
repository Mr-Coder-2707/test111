document.addEventListener('DOMContentLoaded', async () => {
    DB.checkAuth();
    const productSearch = document.getElementById('productSearch');
    const barcodeSearch = document.getElementById('barcodeSearch');
    const searchResults = document.getElementById('searchResults');
    const cartTableBody = document.getElementById('cartTableBody');
    const grandTotalElement = document.getElementById('grandTotal');
    const itemsCountElement = document.getElementById('itemsCount');
    const checkoutBtn = document.getElementById('checkoutBtn');
    const clearCartBtn = document.getElementById('clearCartBtn');
    const customerNameInput = document.getElementById('customerName');
    const paymentTypeSelect = document.getElementById('paymentType');

    let cart = [];
    let products = await DB.getProducts();

    // Barcode Search
    barcodeSearch.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const code = barcodeSearch.value;
            const product = products.find(p => p.barcode === code);
            if (product) {
                addToCart(product);
                barcodeSearch.value = '';
                DB.showToast('تمت إضافة: ' + product.name);
            } else {
                DB.showToast('لم يتم العثور على الباركود', 'error');
            }
        }
    });

    // Smart Search logic
    productSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (!query) {
            searchResults.style.display = 'none';
            return;
        }

        const filtered = products
            .map(p => {
                let score = 0;
                const name = p.name.toLowerCase();
                if (name === query) score = 100;
                else if (name.startsWith(query)) score = 80;
                else if (name.includes(query)) score = 50;
                return { ...p, score };
            })
            .filter(p => p.score > 0)
            .sort((a, b) => b.score - a.score);

        renderSearchResults(filtered);
    });

    function renderSearchResults(results) {
        searchResults.innerHTML = '';
        if (results.length === 0) {
            searchResults.style.display = 'none';
            return;
        }

        results.forEach(product => {
            const div = document.createElement('div');
            div.className = 'search-item';
            div.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>${product.name}</span>
                    <span style="color: var(--primary-color);">${product.price} ج.م</span>
                </div>
                <small style="color: var(--text-gray);">الباركود: ${product.barcode || '--'} | المخزون: ${product.stock}</small>
            `;
            div.onclick = () => addToCart(product);
            searchResults.appendChild(div);
        });
        searchResults.style.display = 'block';
    }

    function addToCart(product) {
        if (product.stock <= 0) {
            DB.showToast('الكمية غير كافية في المخزن!', 'error');
            return;
        }
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
            if (existing.quantity >= product.stock) {
                DB.showToast('لا يمكن تجاوز الكمية المتاحة!', 'warning');
                return;
            }
            existing.quantity += 1;
        } else {
            cart.push({ ...product, quantity: 1 });
        }
        productSearch.value = '';
        searchResults.style.display = 'none';
        renderCart();
    }

    function renderCart() {
        cartTableBody.innerHTML = '';
        let total = 0;
        let count = 0;

        cart.forEach(item => {
            const tr = document.createElement('tr');
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            count += item.quantity;

            tr.innerHTML = `
                <td>${item.name}</td>
                <td>
                    <input type="number" value="${item.price}" min="0" step="0.01"
                        style="width: 80px; padding: 5px; text-align: center;" 
                        onchange="updatePrice(${item.id}, this.value)"
                        title="السعر قابل للتعديل">
                </td>
                <td>
                    <input type="number" value="${item.quantity}" min="1" max="${item.stock}"
                        style="width: 60px; padding: 5px; text-align: center;" 
                        onchange="updateQty(${item.id}, this.value)">
                </td>
                <td>${itemTotal.toFixed(2)}</td>
                <td>
                    <button class="btn btn-danger" onclick="remove(${item.id})" style="padding: 5px 10px;">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            `;
            cartTableBody.appendChild(tr);
        });

        grandTotalElement.innerText = total.toFixed(2);
        itemsCountElement.innerText = count;
    }

    window.updateQty = (id, qty) => {
        const item = cart.find(item => item.id === id);
        if (item) {
            const newQty = parseInt(qty) || 0;
            if (newQty > item.stock) {
                DB.showToast('الكمية المتاحة فقط ' + item.stock, 'warning');
                item.quantity = item.stock;
            } else {
                item.quantity = newQty;
            }
            if (item.quantity <= 0) cart = cart.filter(i => i.id !== id);
        }
        renderCart();
    };

    window.updatePrice = (id, price) => {
        const item = cart.find(item => item.id === id);
        if (item) {
            const newPrice = parseFloat(price) || 0;
            if (newPrice < 0) {
                DB.showToast('السعر لا يمكن أن يكون سالب!', 'error');
                item.price = 0;
            } else {
                item.price = newPrice;
                DB.showToast('تم تعديل السعر بنجاح');
            }
        }
        renderCart();
    };

    window.remove = (id) => {
        cart = cart.filter(item => item.id !== id);
        renderCart();
    };

    checkoutBtn.onclick = async () => {
        if (cart.length === 0) {
            DB.showToast('الفاتورة فارغة!', 'error');
            return;
        }

        const paymentType = paymentTypeSelect.value;
        const customerName = customerNameInput.value || (paymentType === 'debt' ? null : 'عميل نقدي');

        if (paymentType === 'debt' && !customerName) {
            DB.showToast('يجب إدخال اسم العميل للمعاملات الآجلة!', 'error');
            return;
        }

        const currentUser = DB.getCurrentUser();
        const sale = {
            date: new Date().toISOString(),
            customer: customerName || 'عميل نقدي',
            paymentType: paymentType,
            items: cart.map(item => ({id: item.id, name: item.name, price: item.price, quantity: item.quantity, cost: item.cost})),
            total: parseFloat(grandTotalElement.innerText),
            user: currentUser ? currentUser.name : 'غير محدد'
        };

        await DB.saveSale(sale);

        // Handle Debt
        if (paymentType === 'debt') {
            const customers = await DB.getCustomers();
            let cust = customers.find(c => c.name === customerName);
            if (!cust) {
                cust = { name: customerName, phone: '', balance: 0 };
            }
            cust.balance = (cust.balance || 0) + sale.total;
            await DB.saveCustomer(cust);
        }

        if(await DB.confirm('تمت العملية بنجاح! هل تريد طباعة الفاتورة؟')) {
            printReceipt(sale);
        }
        
        DB.showToast('تم حفظ العملية بنجاح');
        cart = [];
        customerNameInput.value = '';
        products = await DB.getProducts(); // Refresh local list
        renderCart();
    };

    function printReceipt(sale) {
        // Save sale data to localStorage for the print page
        localStorage.setItem('lastSaleForPrint', JSON.stringify(sale));
        
        // Open print page in new window
        const printUrl = 'print-invoice.html?data=' + encodeURIComponent(JSON.stringify(sale));
        window.open(printUrl, '_blank', 'width=900,height=700');
    }

    clearCartBtn.onclick = async () => {
        if (await DB.confirm('هل أنت متأكد من مسح الفاتورة؟')) {
            cart = [];
            renderCart();
        }
    };
    
    // Returns functionality
    const returnBtn = document.getElementById('returnBtn');
    let selectedSaleForReturn = null;
    
    returnBtn.onclick = async () => {
        openReturnModal();
    };
    
    window.openReturnModal = async () => {
        const modal = document.getElementById('returnModal');
        const tableBody = document.getElementById('returnSalesTableBody');
        const searchInput = document.getElementById('returnSearchInput');
        
        modal.style.display = 'block';
        
        await renderSalesList();
        
        searchInput.addEventListener('input', async () => {
            await renderSalesList(searchInput.value);
        });
    };
    
    async function renderSalesList(searchQuery = '') {
        const tableBody = document.getElementById('returnSalesTableBody');
        const sales = await DB.getSales();
        
        // Filter out already returned sales and apply search
        let filteredSales = sales.filter(s => !s.returned);
        
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filteredSales = filteredSales.filter(s => 
                s.customer.toLowerCase().includes(query) || 
                s.id.toString().includes(query)
            );
        }
        
        // Sort by date (newest first)
        filteredSales.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        tableBody.innerHTML = '';
        
        if (filteredSales.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا توجد فواتير</td></tr>';
            return;
        }
        
        filteredSales.forEach(sale => {
            const tr = document.createElement('tr');
            const date = new Date(sale.date);
            const dateStr = date.toLocaleDateString('ar-EG') + ' ' + date.toLocaleTimeString('ar-EG', {hour: '2-digit', minute: '2-digit'});
            
            tr.innerHTML = `
                <td>${dateStr}</td>
                <td>${sale.customer}</td>
                <td>${sale.total.toFixed(2)} ج.م</td>
                <td><span class="badge ${sale.paymentType === 'cash' ? 'badge-success' : 'badge-warning'}">${sale.paymentType === 'cash' ? 'نقدي' : 'آجل'}</span></td>
                <td>
                    <button class="btn btn-warning" onclick="selectSaleForReturn(${sale.id})" style="padding: 5px 15px;">
                        <i class="fas fa-undo"></i> إرجاع
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }
    
    window.selectSaleForReturn = async (saleId) => {
        const sales = await DB.getSales();
        selectedSaleForReturn = sales.find(s => s.id === saleId);
        
        if (!selectedSaleForReturn) {
            DB.showToast('الفاتورة غير موجودة!', 'error');
            return;
        }
        
        closeReturnModal();
        openReturnItemsModal();
    };
    
    window.openReturnItemsModal = () => {
        const modal = document.getElementById('returnItemsModal');
        const container = document.getElementById('returnItemsContainer');
        
        container.innerHTML = '';
        
        selectedSaleForReturn.items.forEach((item, index) => {
            // البحث عن المنتج في المخزن للحصول على الكمية الحالية
            const productInStock = products.find(p => p.id === item.id);
            const currentStock = productInStock ? productInStock.stock : 0;
            
            const div = document.createElement('div');
            div.style.cssText = 'border: 1px solid #ddd; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; background: #f9fafb;';
            div.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--primary-color);">${item.name}</h4>
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <p style="margin: 0; color: var(--text-gray);">السعر: ${item.price} ج.م × الإجمالي: ${(item.price * item.quantity).toFixed(2)} ج.م</p>
                        <div style="background: #e0f2fe; padding: 0.5rem 1rem; border-radius: 6px; border: 2px solid var(--info);">
                            <span style="color: var(--text-gray); font-size: 0.85rem;">
                                <i class="fas fa-warehouse"></i> المخزن الحالي:
                            </span>
                            <strong style="color: var(--info); font-size: 1.1rem; margin-right: 0.5rem;">${currentStock}</strong>
                        </div>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; align-items: center; background: white; padding: 1rem; border-radius: 6px;">
                    <div style="text-align: center;">
                        <label style="display: block; color: var(--text-gray); font-size: 0.85rem; margin-bottom: 0.5rem;">
                            <i class="fas fa-receipt"></i> العدد بالفاتورة
                        </label>
                        <div style="font-size: 1.5rem; font-weight: bold; color: var(--success);">${item.quantity}</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <label style="display: block; color: var(--text-gray); font-size: 0.85rem; margin-bottom: 0.5rem;">
                            <i class="fas fa-undo"></i> العدد المرتجع
                        </label>
                        <input type="number" id="returnQty_${index}" value="${item.quantity}" min="0" max="${item.quantity}" 
                            style="width: 100%; padding: 10px; text-align: center; border: 2px solid var(--warning); border-radius: 6px; font-size: 1.2rem; font-weight: bold; color: var(--warning);"
                            oninput="updateReturnInfo(${index}, this.value, ${item.quantity}, ${item.price}, ${currentStock})">
                    </div>
                    
                    <div style="text-align: center;">
                        <label style="display: block; color: var(--text-gray); font-size: 0.85rem; margin-bottom: 0.5rem;">
                            <i class="fas fa-box-open"></i> الباقي بالفاتورة
                        </label>
                        <div id="remainingQty_${index}" style="font-size: 1.5rem; font-weight: bold; color: var(--info);">0</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <label style="display: block; color: var(--text-gray); font-size: 0.85rem; margin-bottom: 0.5rem;">
                            <i class="fas fa-warehouse"></i> المخزن بعد الإرجاع
                        </label>
                        <div id="stockAfterReturn_${index}" style="font-size: 1.5rem; font-weight: bold; color: var(--primary-color);">${currentStock}</div>
                    </div>
                    
                    <div style="text-align: center;">
                        <label style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer; padding: 10px; background: var(--primary-color); color: white; border-radius: 6px; transition: all 0.3s;">
                            <input type="checkbox" id="returnItem_${index}" checked style="width: 20px; height: 20px; cursor: pointer;">
                            <span style="font-weight: 600;">تفعيل</span>
                        </label>
                    </div>
                </div>
                
                <div style="margin-top: 0.5rem; padding: 0.75rem; background: #fef3c7; border-right: 4px solid var(--warning); border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-gray); font-size: 0.9rem;">
                            <i class="fas fa-coins"></i> مبلغ الإرجاع:
                        </span>
                        <span id="returnAmount_${index}" style="font-weight: bold; color: var(--warning); font-size: 1.1rem;">
                            ${(item.price * item.quantity).toFixed(2)} ج.م
                        </span>
                    </div>
                </div>
            `;
            container.appendChild(div);
            
            // Initialize remaining quantity and stock after return
            updateReturnInfo(index, item.quantity, item.quantity, item.price, currentStock);
        });
        
        // إضافة بطاقة الإجمالي الكلي
        const totalCard = document.createElement('div');
        totalCard.style.cssText = 'background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%); color: white; padding: 1.5rem; border-radius: 8px; margin-top: 1rem;';
        totalCard.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; text-align: center;">
                <div>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                        <i class="fas fa-box"></i> إجمالي الأصناف
                    </div>
                    <div style="font-size: 1.8rem; font-weight: bold;">${selectedSaleForReturn.items.length}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                        <i class="fas fa-sort-numeric-up"></i> إجمالي الكمية
                    </div>
                    <div style="font-size: 1.8rem; font-weight: bold;">${selectedSaleForReturn.items.reduce((sum, item) => sum + item.quantity, 0)}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; opacity: 0.9; margin-bottom: 0.5rem;">
                        <i class="fas fa-money-bill-wave"></i> مبلغ الفاتورة
                    </div>
                    <div style="font-size: 1.8rem; font-weight: bold;">${selectedSaleForReturn.total.toFixed(2)} ج.م</div>
                </div>
            </div>
        `;
        container.appendChild(totalCard);
        
        modal.style.display = 'block';
    };
    
    // دالة لتحديث معلومات الإرجاع (الكمية المتبقية والمبلغ والمخزن)
    window.updateReturnInfo = (index, returnValue, originalQty, price, currentStock) => {
        const checkbox = document.getElementById(`returnItem_${index}`);
        const remainingQtyElement = document.getElementById(`remainingQty_${index}`);
        const returnAmountElement = document.getElementById(`returnAmount_${index}`);
        const stockAfterReturnElement = document.getElementById(`stockAfterReturn_${index}`);
        
        const returnQty = parseInt(returnValue) || 0;
        const remaining = originalQty - returnQty;
        const amount = returnQty * price;
        const stockAfterReturn = currentStock + returnQty;
        
        // تحديث الكمية المتبقية في الفاتورة
        if (remainingQtyElement) {
            remainingQtyElement.textContent = remaining;
            // تغيير اللون حسب الكمية المتبقية
            if (remaining === 0) {
                remainingQtyElement.style.color = 'var(--danger)';
            } else if (remaining < originalQty / 2) {
                remainingQtyElement.style.color = 'var(--warning)';
            } else {
                remainingQtyElement.style.color = 'var(--info)';
            }
        }
        
        // تحديث المخزن بعد الإرجاع
        if (stockAfterReturnElement) {
            stockAfterReturnElement.textContent = stockAfterReturn;
            // تغيير اللون حسب كمية المخزن
            if (stockAfterReturn > currentStock) {
                stockAfterReturnElement.style.color = 'var(--success)';
            } else {
                stockAfterReturnElement.style.color = 'var(--primary-color)';
            }
        }
        
        // تحديث مبلغ الإرجاع
        if (returnAmountElement) {
            returnAmountElement.textContent = `${amount.toFixed(2)} ج.م`;
        }
        
        // تحديث حالة الـ checkbox
        if (returnQty === 0) {
            checkbox.checked = false;
        } else {
            checkbox.checked = true;
        }
    };
    
    window.confirmReturn = async () => {
        if (!selectedSaleForReturn) return;
        
        const returnItems = [];
        let totalReturnAmount = 0;
        
        selectedSaleForReturn.items.forEach((item, index) => {
            const checkbox = document.getElementById(`returnItem_${index}`);
            const qtyInput = document.getElementById(`returnQty_${index}`);
            
            if (checkbox && checkbox.checked) {
                const qty = parseInt(qtyInput.value) || 0;
                if (qty > 0 && qty <= item.quantity) {
                    const itemTotal = item.price * qty;
                    totalReturnAmount += itemTotal;
                    returnItems.push({
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        quantity: qty,
                        cost: item.cost
                    });
                }
            }
        });
        
        if (returnItems.length === 0) {
            DB.showToast('الرجاء اختيار صنف واحد على الأقل للإرجاع!', 'warning');
            return;
        }
        
        const itemsText = returnItems.map(item => `${item.name} (الكمية: ${item.quantity})`).join('\n');
        const confirm = await DB.confirm(
            `هل أنت متأكد من إرجاع هذه الأصناف؟\n\n` +
            `${itemsText}\n\n` +
            `إجمالي المبلغ المرتجع: ${totalReturnAmount.toFixed(2)} ج.م\n\n` +
            `سيتم إرجاع الأصناف للمخزون وخصم المبلغ من رصيد العميل إن وجد.`
        );
        
        if (!confirm) return;
        
        try {
            await DB.saveReturn(selectedSaleForReturn.id, returnItems);
            DB.showToast('تم إرجاع الأصناف بنجاح!', 'success');
            closeReturnItemsModal();
            selectedSaleForReturn = null;
            products = await DB.getProducts(); // Refresh products
        } catch (error) {
            DB.showToast('حدث خطأ: ' + error.message, 'error');
        }
    };
    
    window.closeReturnModal = () => {
        document.getElementById('returnModal').style.display = 'none';
    };
    
    window.closeReturnItemsModal = () => {
        document.getElementById('returnItemsModal').style.display = 'none';
    };
});
