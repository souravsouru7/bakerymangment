const express = require('express');
const productController = require('../controllers/productController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// Protect all routes after this middleware
router.use(protect);

// Specific routes should come before parameterized routes
router.get('/inventory/total', productController.getTotalInventoryValue);
router.get('/inventory/category', productController.getCategoryWiseValue);
router.get('/inventory/income-stats', productController.getInventoryIncomeStats);
router.get('/daily-income', productController.getDailyIncomeStats);

// Generic CRUD routes
router.get('/', productController.getAllProducts);
router.post('/', restrictTo('admin'), productController.createProduct);
router.get('/:id', productController.getProductById);
router.patch('/:id', restrictTo('admin'), productController.updateProduct);
router.delete('/:id', restrictTo('admin'), productController.deleteProduct);

module.exports = router;