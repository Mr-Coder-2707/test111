document.addEventListener('DOMContentLoaded', async () => {
    const user = DB.checkAuth();
    if (user && user.role !== 'admin') {
        DB.showToast('المدير فقط يمكنه رؤية التقارير المالية', 'error');
        setTimeout(() => location.href = 'index.html', 2000);
        return;
    }

    const salesTableBody = document.getElementById('salesTableBody');
    const dailyTotalElement = document.getElementById('dailyTotal');
    const dailyProfitElement = document.getElementById('dailyProfit');
    const invoiceCountElement = document.getElementById('invoiceCount');
    const topProductElement = document.getElementById('topProduct');

    let sales = await DB.getSales();
    let expenses = await DB.getExpenses();

    async function renderReports() {
        salesTableBody.innerHTML = '';
        let totalSales = 0;
        let totalProfit = 0;
        let todayCount = 0;
        let todayExpenses = 0;
        const productCounts = {};
        const dailyData = {}; 

        const today = new Date().toLocaleDateString();

        expenses.forEach(exp => {
            if (new Date(exp.date).toLocaleDateString() === today) {
                todayExpenses += exp.amount;
            }
        });

        sales.sort((a,b) => b.id - a.id).forEach(sale => {
            const dateObj = new Date(sale.date);
            const saleDate = dateObj.toLocaleDateString();
            
            dailyData[saleDate] = (dailyData[saleDate] || 0) + sale.total;

            if (saleDate === today) {
                totalSales += sale.total;
                todayCount++;
                sale.items.forEach(item => {
                    const itemProfit = (item.price - (item.cost || 0)) * item.quantity;
                    totalProfit += itemProfit;
                });
            }

            sale.items.forEach(item => {
                productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
            });

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${sale.id.toString().slice(-6)}</td>
                <td>${dateObj.toLocaleString('ar-EG')}</td>
                <td>${sale.customer} <br><small style="color:var(--text-gray)">${sale.paymentType === 'cash' ? 'نقدي' : 'آجل'}</small></td>
                <td>${sale.items.length} أصناف</td>
                <td style="font-weight: 700;">${sale.total.toFixed(2)}</td>
                <td>
                    <button class="btn btn-primary" onclick="viewSale(${sale.id})" style="padding: 5px 10px;"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-danger" onclick="processReturn(${sale.id})" style="padding: 5px 10px;"><i class="fas fa-undo"></i></button>
                </td>
            `;
            salesTableBody.appendChild(tr);
        });

        dailyTotalElement.innerText = totalSales.toFixed(2) + ' ج.م';
        dailyProfitElement.innerText = (totalProfit - todayExpenses).toFixed(2) + ' ج.م';
        invoiceCountElement.innerText = todayCount;

        let top = '--';
        let max = 0;
        for (const [name, qty] of Object.entries(productCounts)) {
            if (qty > max) { max = qty; top = name; }
        }
        topProductElement.innerText = top;

        renderChart(dailyData);
    }

    function renderChart(dailyData) {
        const ctx = document.getElementById('salesChart').getContext('2d');
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            last7Days.push(d.toLocaleDateString());
        }

        const values = last7Days.map(l => dailyData[l] || 0);

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'المبيعات اليومية',
                    data: values,
                    borderColor: '#00d2ff',
                    backgroundColor: 'rgba(0, 210, 255, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    window.processReturn = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (!sale) return;

        if (await DB.confirm('هل تريد عمل مرتجع لهذه الفاتورة؟', 'تأكيد المرتجع')) {
            const allProducts = await DB.getProducts();
            for (const soldItem of sale.items) {
                const product = allProducts.find(p => p.id === soldItem.id);
                if (product) {
                    product.stock += soldItem.quantity;
                    await DB.saveProduct(product);
                }
            }
            
            if (sale.paymentType === 'debt') {
                const customers = await DB.getCustomers();
                const cust = customers.find(c => c.name === sale.customer);
                if (cust) {
                    cust.balance -= sale.total;
                    await DB.saveCustomer(cust);
                }
            }

            await DB.deleteSale(id);
            DB.showToast('تمت عملية المرتجع');
            sales = await DB.getSales();
            renderReports();
        }
    };

    window.viewSale = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale) {
            let details = `
                <table style="width:100%; border-collapse:collapse; margin-top:1rem; font-size:0.9rem;">
                    <thead><tr style="border-bottom:1px solid #444; color:var(--primary-color);">
                        <th style="padding:8px; text-align:right;">الصنف</th>
                        <th style="padding:8px; text-align:center;">الكمية</th>
                        <th style="padding:8px; text-align:center;">السعر</th>
                    </tr></thead>
                    <tbody>
                        ${sale.items.map(i => `
                        <tr style="border-bottom:1px solid #333;">
                            <td style="padding:8px;">${i.name}</td>
                            <td style="padding:8px; text-align:center;">${i.quantity}</td>
                            <td style="padding:8px; text-align:center;">${i.price}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            `;
            await DB.confirm(details, `معاينة فاتورة - ${sale.customer}`);
        }
    };

    renderReports();
});
