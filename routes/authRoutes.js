const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/verify', authController.verifyToken);

// Protected routes example (if you need them)
router.use(authController.protect); // Middleware to protect all routes below


module.exports = router;