document.addEventListener('DOMContentLoaded', async () => {
    const user = DB.checkAuth();
    if (user) {
        document.getElementById('userNameDisplay').innerText = user.name;
    }

    const sales = await DB.getSales();
    const products = await DB.getProducts();
    const expenses = await DB.getExpenses();
    const today = new Date().toLocaleDateString();

    let todaySalesTotal = 0;
    let todayProfitTotal = 0;
    let todayExpensesTotal = 0;
    const productSalesCount = {};

    // Process Today's Data
    sales.forEach(sale => {
        const saleDate = new Date(sale.date).toLocaleDateString();
        if (saleDate === today) {
            todaySalesTotal += sale.total;
            sale.items.forEach(item => {
                const profit = (item.price - (item.cost || 0)) * item.quantity;
                todayProfitTotal += profit;
            });
        }
        
        // Count for Top Products
        sale.items.forEach(item => {
            productSalesCount[item.name] = (productSalesCount[item.name] || 0) + item.quantity;
        });
    });

    expenses.forEach(exp => {
        const expDate = new Date(exp.date).toLocaleDateString();
        if (expDate === today) {
            todayExpensesTotal += exp.amount;
        }
    });

    const lowStock = products.filter(p => p.stock < 10).length;

    // UI Updates
    document.getElementById('todaySales').innerText = todaySalesTotal.toLocaleString();
    document.getElementById('todayProfit').innerText = (todayProfitTotal - todayExpensesTotal).toLocaleString();
    document.getElementById('todayExpenses').innerText = todayExpensesTotal.toLocaleString();
    document.getElementById('lowStockCount').innerText = lowStock;

    // Render Top Products
    const topProductsList = document.getElementById('topProductsList');
    const sorted = Object.entries(productSalesCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    sorted.forEach(([name, qty]) => {
        const div = document.createElement('div');
        div.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:0.75rem; background:rgba(255,255,255,0.03); border-radius:10px;';
        div.innerHTML = `<span>${name}</span> <span style="color:var(--primary-color); font-weight:bold;">${qty} قطة</span>`;
        topProductsList.appendChild(div);
    });

    // Chart Data (Last 7 Days)
    const dailyData = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyData[d.toLocaleDateString()] = 0;
    }

    sales.forEach(sale => {
        const d = new Date(sale.date).toLocaleDateString();
        if (dailyData[d] !== undefined) {
            dailyData[d] += sale.total;
        }
    });

    const ctx = document.getElementById('mainDashboardChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(dailyData),
            datasets: [{
                label: 'المبيعات',
                data: Object.values(dailyData),
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
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
});
