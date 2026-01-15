// نظام فحص الصلاحيات
(function() {
    'use strict';
    
    // الصفحات المحمية (للمديرين فقط)
    const adminOnlyPages = [
        'products.html',
        'purchases.html',
        'expenses.html',
        'suppliers.html',
        'customers.html',
        'reports.html',
        'profit-loss.html',
        'stock-movements.html'
    ];
    
    // الصفحات المسموحة للبائعين
    const sellerAllowedPages = [
        'index.html',
        'dashboard.html',
        'print-invoice.html',
        'print-barcode.html'
    ];
    
    // فحص الصلاحيات عند تحميل الصفحة
    function checkPagePermission() {
        const currentPage = location.pathname.split('/').pop() || 'index.html';
        const user = DB.getCurrentUser();
        
        // إذا لم يكن هناك مستخدم مسجل، إعادة التوجيه لصفحة تسجيل الدخول
        if (!user) {
            if (currentPage !== 'login.html') {
                location.href = 'login.html';
            }
            return;
        }
        
        // المديرين لديهم صلاحيات كاملة
        if (user.role === 'admin') {
            return;
        }
        
        // البائعين - فحص الصفحات المسموحة
        if (user.role === 'seller') {
            if (adminOnlyPages.includes(currentPage)) {
                DB.showToast('ليس لديك صلاحية للوصول لهذه الصفحة - البائع يبيع فقط', 'error');
                setTimeout(() => location.href = 'index.html', 1500);
                return;
            }
        }
    }
    
    // إخفاء عناصر واجهة المستخدم حسب الصلاحيات
    function hideUIElements() {
        const user = DB.getCurrentUser();
        if (!user) return;
        
        // إذا كان البائع
        if (user.role === 'seller') {
            // إخفاء روابط القوائم الخاصة بالمديرين
            document.querySelectorAll('a[href="products.html"], a[href="purchases.html"], a[href="expenses.html"], a[href="suppliers.html"], a[href="customers.html"], a[href="reports.html"], a[href="profit-loss.html"], a[href="stock-movements.html"]').forEach(link => {
                link.style.display = 'none';
            });
            
            // إخفاء أزرار النسخ الاحتياطي
            document.querySelectorAll('button[onclick="DB.backup()"], label[title="استعادة بيانات"]').forEach(btn => {
                btn.style.display = 'none';
            });
            
            // إخفاء زر النواقص
            document.querySelectorAll('button[onclick="DB.showLowStockModal()"]').forEach(btn => {
                btn.style.display = 'none';
            });
        }
    }
    
    // تشغيل فحص الصلاحيات عند تحميل الصفحة
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            checkPagePermission();
            hideUIElements();
        });
    } else {
        checkPagePermission();
        hideUIElements();
    }
})();
