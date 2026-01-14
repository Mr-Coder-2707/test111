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
});
