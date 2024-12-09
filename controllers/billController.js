const Product = require('../models/productModel');
const Bill = require('../models/billModel');
const PDFDocument = require('pdfkit');
const moment = require('moment');

exports.generateBill = async (req, res) => {
  try {
    const { items, paymentMethod } = req.body;

    let totalCost = 0;
    const billItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);

      if (!product) {
        return res.status(404).json({
          status: 'fail',
          message: `Product with ID ${item.productId} not found`,
        });
      }

      // Check if enough stock is available
      if (product.currentStock < item.quantity) {
        return res.status(400).json({
          status: 'fail',
          message: `Insufficient stock for product: ${product.name}`,
        });
      }

      const cost = product.costPrice * item.quantity;
      totalCost += cost;

      billItems.push({
        product: product._id,
        quantity: item.quantity,
        cost
      });

      // Update product stock
      await Product.findByIdAndUpdate(product._id, {
        $inc: { currentStock: -item.quantity }
      });
    }

    // Create and save the bill
    const bill = await Bill.create({
      items: billItems,
      totalCost,
      paymentMethod
    });

    // Populate product details in the response
    const populatedBill = await Bill.findById(bill._id).populate('items.product');

    // Generate PDF
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.status(201).json({
        status: 'success',
        data: {
          bill: populatedBill,
          pdf: pdfData.toString('base64') // Send PDF as base64 string
        }
      });
    });

    // Add content to PDF
    doc.fontSize(20).text('Bill Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);

    // Add bill details
    doc.text(`Bill ID: ${bill._id}`);
    doc.text(`Date: ${new Date(bill.createdAt).toLocaleString()}`);
    doc.text(`Payment Method: ${paymentMethod}`);
    doc.moveDown();

    // Add items table
    doc.text('Items:', { underline: true });
    doc.moveDown();
    
    populatedBill.items.forEach(item => {
      doc.text(`Product: ${item.product.name}`);
      doc.text(`Quantity: ${item.quantity}`);
      doc.text(`Cost: $${item.cost.toFixed(2)}`);
      doc.moveDown();
    });

    // Add total
    doc.moveDown();
    doc.fontSize(14).text(`Total Cost: $${totalCost.toFixed(2)}`, { underline: true });

    // Finalize PDF
    doc.end();

    // Update daily income with payment method
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const updateData = {
      $inc: {
        totalIncome: totalCost,
        billCount: 1,
        [`paymentMethods.${paymentMethod.toLowerCase()}`]: totalCost
      }
    };

    await DailyIncome.findOneAndUpdate(
      { date: today },
      updateData,
      { upsert: true }
    );

  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get all bills
exports.getAllBills = async (req, res) => {
  try {
    const bills = await Bill.find()
      .populate('items.product')
      .sort('-createdAt');

    res.status(200).json({
      status: 'success',
      results: bills.length,
      data: {
        bills
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get single bill by ID
exports.getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('items.product');

    if (!bill) {
      return res.status(404).json({
        status: 'fail',
        message: 'Bill not found'
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        bill
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Generate PDF for existing bill
exports.generatePDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('items.product');

    if (!bill) {
      return res.status(404).json({
        status: 'fail',
        message: 'Bill not found'
      });
    }

    // Generate PDF
    const doc = new PDFDocument();
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      let pdfData = Buffer.concat(buffers);
      res.status(200).json({
        status: 'success',
        data: {
          pdf: pdfData.toString('base64')
        }
      });
    });

    // Add content to PDF
    doc.fontSize(20).text('Bill Receipt', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12);

    // Add bill details
    doc.text(`Bill ID: ${bill._id}`);
    doc.text(`Date: ${new Date(bill.createdAt).toLocaleString()}`);
    doc.text(`Payment Method: ${bill.paymentMethod}`);
    doc.moveDown();

  
    doc.text('Items:', { underline: true });
    doc.moveDown();
    
    bill.items.forEach(item => {
      doc.text(`Product: ${item.product.name}`);
      doc.text(`Quantity: ${item.quantity}`);
      doc.text(`Cost: $${item.cost.toFixed(2)}`);
      doc.moveDown();
    });

    // Add total
    doc.moveDown();
    doc.fontSize(14).text(`Total Cost: $${bill.totalCost.toFixed(2)}`, { underline: true });

    // Finalize PDF
    doc.end();

  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

exports.getIncomeStats = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const endDate = moment().endOf('day');
    let startDate;
    let groupBy;

    switch (period) {
      case 'weekly':
        startDate = moment().subtract(7, 'days').startOf('day');
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
        break;
      case 'monthly':
        startDate = moment().subtract(30, 'days').startOf('day');
        groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$date" } };
        break;
      default: // daily
        startDate = moment().subtract(24, 'hours').startOf('day');
        groupBy = { $dateToString: { format: "%H:00", date: "$date" } };
    }

    const incomeData = await DailyIncome.aggregate([
      {
        $match: {
          date: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          }
        }
      },
      {
        $group: {
          _id: groupBy,
          totalIncome: { $sum: "$totalIncome" },
          billCount: { $sum: "$billCount" },
          cashPayments: { $sum: "$paymentMethods.cash" },
          cardPayments: { $sum: "$paymentMethods.card" },
          upiPayments: { $sum: "$paymentMethods.upi" }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        period,
        stats: incomeData.map(item => ({
          label: item._id,
          totalIncome: item.totalIncome,
          billCount: item.billCount,
          paymentMethods: {
            cash: item.cashPayments,
            card: item.cardPayments,
            upi: item.upiPayments
          }
        }))
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
}; 