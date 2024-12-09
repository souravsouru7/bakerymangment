const express = require('express');
const { 
  generateBill, 
  getAllBills, 
  getBillById,
  generatePDF 
} = require('../controllers/billController');

const router = express.Router();

router.post('/generate', generateBill);
router.get('/', getAllBills);
router.get('/:id', getBillById);
router.get('/:id/pdf', generatePDF);



module.exports = router; 