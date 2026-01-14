// Test file to verify localStorage functionality
console.log('🧪 Testing localStorage functionality...');

// Test 1: Check if localStorage is available
try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
    console.log('✅ Test 1: localStorage is available');
} catch (e) {
    console.error('❌ Test 1 Failed: localStorage is not available', e);
}

// Test 2: Test DB.save and DB.load
if (typeof DB !== 'undefined') {
    console.log('✅ Test 2: DB object is loaded');
    
    // Test save
    const testData = [{ id: 1, name: 'Test Product', price: 100 }];
    DB.save('test_products', testData);
    console.log('✅ Test 3: Data saved successfully');
    
    // Test load
    const loaded = DB.load('test_products');
    if (JSON.stringify(loaded) === JSON.stringify(testData)) {
        console.log('✅ Test 4: Data loaded successfully');
    } else {
        console.error('❌ Test 4 Failed: Data mismatch');
    }
    
    // Cleanup
    localStorage.removeItem('test_products');
    console.log('✅ Test 5: Cleanup completed');
} else {
    console.error('❌ Test 2 Failed: DB object not found');
}

// Test 3: Check if initial_data is loaded
if (typeof initialProducts !== 'undefined') {
    console.log(`✅ Test 6: initialProducts loaded (${initialProducts.length} products)`);
} else {
    console.warn('⚠️ Test 6: initialProducts not loaded (this is OK if not on products page)');
}

// Test 4: Check current data in localStorage
const storedProducts = localStorage.getItem('pos_products');
if (storedProducts) {
    const products = JSON.parse(storedProducts);
    console.log(`✅ Test 7: Found ${products.length} products in localStorage`);
} else {
    console.log('ℹ️ Test 7: No products in localStorage yet');
}

// Test 5: Check initialization flag
const isInitialized = localStorage.getItem('pos_initialized');
if (isInitialized) {
    console.log('✅ Test 8: System is initialized');
} else {
    console.log('ℹ️ Test 8: System not initialized yet (first run)');
}

console.log('🎉 All tests completed!');
console.log('📊 localStorage Status:');
console.log('   - Products:', localStorage.getItem('pos_products') ? 'EXISTS' : 'EMPTY');
console.log('   - Sales:', localStorage.getItem('pos_sales') ? 'EXISTS' : 'EMPTY');
console.log('   - Initialized:', isInitialized || 'NO');
