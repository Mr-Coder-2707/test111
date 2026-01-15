document.addEventListener('DOMContentLoaded', async () => {
    const user = DB.checkAuth();
    if (user && user.role !== 'admin') {
        DB.showToast('عذراً، المدير فقط من يمكنه تعديل المخزن', 'error');
        setTimeout(() => location.href = 'index.html', 2000);
        return;
    }

    const productForm = document.getElementById('productForm');
    const productTableBody = document.getElementById('productTableBody');
    const productIdInput = document.getElementById('productId');
    const cancelEditBtn = document.getElementById('cancelEdit');
    const pCategorySelect = document.getElementById('pCategory');
    const addCategoryBtn = document.getElementById('addCategoryBtn');

    let products = await DB.getProducts();
    let categories = await DB.getCategories();

    // Add Barcode input if not exists
    if (!document.getElementById('pBarcode')) {
        const formGrid = document.querySelector('#productForm > div');
        const barcodeGroup = document.createElement('div');
        barcodeGroup.className = 'input-group';
        barcodeGroup.innerHTML = '<label>الباركود</label><input type="text" id="pBarcode" placeholder="مثال: 1001">';
        formGrid.prepend(barcodeGroup);
    }

    function populateCategories() {
        pCategorySelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    addCategoryBtn.onclick = async () => {
        const newCat = await DB.prompt('أدخل اسم التصنيف الجديد:');
        if (newCat && !categories.includes(newCat)) {
            categories.push(newCat);
            await DB.saveCategories(categories);
            populateCategories();
            pCategorySelect.value = newCat;
        }
    };

    function renderProducts() {
        productTableBody.innerHTML = '';
        products.sort((a,b) => b.id - a.id).forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${p.name}</td>
                <td><span style="background: rgba(0,210,255,0.1); padding: 4px 8px; border-radius: 5px;">${p.category}</span></td>
                <td>${(p.price || 0).toFixed(2)}</td>
                <td>${(p.cost || 0).toFixed(2)}</td>
                <td style="color: ${p.stock < 10 ? 'var(--danger)' : 'inherit'}; font-weight: ${p.stock < 10 ? 'bold' : 'normal'}">${p.stock}</td>
                <td><code style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">${p.barcode || '--'}</code></td>
                <td>
                    <button class="btn btn-primary" onclick="editProduct(${p.id})" style="padding: 5px 10px;"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger" onclick="deleteProduct(${p.id})" style="padding: 5px 10px;"><i class="fas fa-trash"></i></button>
                </td>
            `;
            productTableBody.appendChild(tr);
        });
    }

    productForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = productIdInput.value ? parseInt(productIdInput.value) : null;
        
        // Generate QR Code if barcode field is empty
        let barcodeValue = document.getElementById('pBarcode').value.trim();
        if (!barcodeValue) {
            // Generate temporary ID for new products
            const tempId = id || Date.now();
            barcodeValue = 'P' + String(tempId).toString().slice(-6).padStart(6, '0');
        }
        
        const product = {
            id,
            barcode: barcodeValue,
            name: document.getElementById('pName').value,
            category: document.getElementById('pCategory').value,
            price: parseFloat(document.getElementById('pPrice').value),
            cost: parseFloat(document.getElementById('pCost').value),
            stock: parseInt(document.getElementById('pStock').value)
        };

        await DB.saveProduct(product);
        DB.showToast(id ? 'تم تحديث الصنف' : 'تم إضافة الصنف');

        products = await DB.getProducts();
        resetForm();
        renderProducts();
    };

    window.editProduct = (id) => {
        const p = products.find(p => p.id === id);
        if (p) {
            productIdInput.value = p.id;
            document.getElementById('pBarcode').value = p.barcode || '';
            document.getElementById('pName').value = p.name;
            document.getElementById('pCategory').value = p.category;
            document.getElementById('pPrice').value = p.price;
            document.getElementById('pCost').value = p.cost || 0;
            document.getElementById('pStock').value = p.stock;
            cancelEditBtn.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    window.deleteProduct = async (id) => {
        if (await DB.confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
            await DB.deleteProduct(id);
            products = await DB.getProducts();
            renderProducts();
            DB.showToast('تم الحذف بنجاح', 'error');
        }
    };

    function resetForm() {
        productForm.reset();
        productIdInput.value = '';
        cancelEditBtn.style.display = 'none';
    }

    cancelEditBtn.onclick = resetForm;

    // Excel Export
    document.getElementById('exportExcel').onclick = () => {
        const exportData = products.map(p => ({
            "الباركود": p.barcode || "",
            "اسم الصنف": p.name,
            "التصنيف": p.category,
            "سعر البيع": p.price,
            "التكلفة": p.cost,
            "الرصيد": p.stock
        }));
        DB.exportToExcel(exportData, `products_report_${new Date().toLocaleDateString()}`);
    };

    // Excel Import
    document.getElementById('excelImport').onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        DB.importFromExcel(file, async (data) => {
            if (data.length === 0) {
                DB.showToast('الملف فارغ أو لا يحتوي على بيانات صحيحة', 'error');
                e.target.value = '';
                return;
            }

            if (await DB.confirm(`هل أنت متأكد من استيراد ${data.length} صنف؟ قد يتم تحديث الأصناف الموجودة بنفس الاسم.`)) {
                const formattedProducts = data.map(item => ({
                    barcode: item["الباركود"] || item["barcode"] || "",
                    name: item["اسم الصنف"] || item["name"] || "",
                    category: item["التصنيف"] || item["category"] || "عام",
                    price: parseFloat(item["سعر البيع"] || item["price"] || 0),
                    cost: parseFloat(item["التكلفة"] || item["cost"] || 0),
                    stock: parseInt(item["الرصيد"] || item["stock"] || 0)
                })).filter(p => p.name && p.name.trim() !== '');

                if (formattedProducts.length === 0) {
                    DB.showToast('لم يتم العثور على منتجات صالحة في الملف', 'error');
                    e.target.value = '';
                    return;
                }

                try {
                    await DB.saveProducts(formattedProducts);
                    
                    // Get updated products list after saving
                    products = await DB.getProducts();
                    
                    // Generate barcode for products without barcode
                    let barcodeCount = 0;
                    products.forEach(p => {
                        if (!p.barcode || p.barcode.trim() === '') {
                            p.barcode = 'P' + String(p.id).padStart(6, '0');
                            barcodeCount++;
                        }
                    });
                    
                    // Save products with generated barcodes
                    if (barcodeCount > 0) {
                        await DB.save(DB.KEYS.PRODUCTS, products);
                    }
                    
                    // Update categories if new ones were imported
                    const importedCategories = [...new Set(formattedProducts.map(p => p.category))];
                    const newCategories = importedCategories.filter(c => !categories.includes(c));
                    if (newCategories.length > 0) {
                        categories = [...categories, ...newCategories];
                        await DB.saveCategories(categories);
                        populateCategories();
                    }
                    
                    let message = `تم استيراد ${formattedProducts.length} صنف بنجاح`;
                    if (barcodeCount > 0) {
                        message += ` وتم توليد باركود لـ ${barcodeCount} منتج`;
                    }
                    DB.showToast(message);
                    
                    renderProducts();
                } catch (err) {
                    console.error('Import error:', err);
                    DB.showToast('حدث خطأ أثناء الاستيراد', 'error');
                }
            }
            e.target.value = ''; // Reset input
        });
    };

    // Clear All
    document.getElementById('clearAllProducts').onclick = async () => {
        if (await DB.confirm('تحذير: هل أنت متأكد من مسح جميع الأصناف؟ لا يمكن التراجع عن هذه العملية.')) {
            localStorage.removeItem(DB.KEYS.PRODUCTS);
            DB.showToast('تم مسح جميع الأصناف بنجاح', 'error');
            products = [];
            renderProducts();
        }
    };
    
    // Generate Barcodes for all products
    window.generateBarcodeForAll = async () => {
        if (await DB.confirm('هل تريد توليد باركود تلقائي لجميع المنتجات التي ليس لها باركود؟')) {
            let count = 0;
            products.forEach(p => {
                if (!p.barcode || p.barcode.trim() === '') {
                    // Generate unique code: P + product ID
                    p.barcode = 'P' + String(p.id).padStart(6, '0');
                    count++;
                }
            });
            
            if (count > 0) {
                await DB.save(DB.KEYS.PRODUCTS, products);
                DB.showToast(`تم توليد باركود لـ ${count} منتج`);
                renderProducts();
            } else {
                DB.showToast('جميع المنتجات لديها باركود بالفعل', 'info');
            }
        }
    };

    // Load Initial Data Button
    document.getElementById('loadInitialData').onclick = async () => {
        if (typeof initialProducts === 'undefined') {
            DB.showToast('البيانات الأولية غير متوفرة', 'error');
            return;
        }
        
        if (await DB.confirm('هل تريد تحميل البيانات الأولية؟ (سيتم دمجها مع البيانات الحالية)')) {
            try {
                await DB.saveProducts(initialProducts);
                
                // Get updated products list
                products = await DB.getProducts();
                
                // Generate barcode for products without barcode
                let barcodeCount = 0;
                products.forEach(p => {
                    if (!p.barcode || p.barcode.trim() === '') {
                        p.barcode = 'P' + String(p.id).padStart(6, '0');
                        barcodeCount++;
                    }
                });
                
                // Save products with generated barcodes
                if (barcodeCount > 0) {
                    await DB.save(DB.KEYS.PRODUCTS, products);
                }
                
                // Update categories
                const importedCategories = [...new Set(initialProducts.map(p => p.category))];
                const newCategories = importedCategories.filter(c => !categories.includes(c));
                if (newCategories.length > 0) {
                    categories = [...categories, ...newCategories];
                    await DB.saveCategories(categories);
                    populateCategories();
                }
                
                let message = `تم تحميل ${initialProducts.length} صنف بنجاح`;
                if (barcodeCount > 0) {
                    message += ` وتم توليد باركود لـ ${barcodeCount} منتج`;
                }
                DB.showToast(message);
                
                renderProducts();
            } catch (err) {
                console.error('Load error:', err);
                DB.showToast('حدث خطأ أثناء التحميل', 'error');
            }
        }
    };

    populateCategories();
    renderProducts();
});
