const Product = require('../models/productModel');
const moment = require('moment');
const Bill = require('../models/billModel');
const DailyIncome = require('../models/dailyIncomeModel');

// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find();
    
    res.status(200).json({
      status: 'success',
      results: products.length,
      data: {
        products,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Create a new product
exports.createProduct = async (req, res) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};


exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: {
        product,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};


exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        status: 'fail',
        message: 'Product not found',
      });
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get total inventory value
exports.getTotalInventoryValue = async (req, res) => {
  try {
    const products = await Product.find();
    
    const inventorySummary = {
      totalProducts: products.length,
      totalItems: 0,
      totalValue: 0,
      averageItemValue: 0
    };

    products.forEach(product => {
      inventorySummary.totalItems += product.currentStock;
      inventorySummary.totalValue += product.currentStock * product.costPrice;
    });

    // Calculate average value per item
    inventorySummary.averageItemValue = 
      inventorySummary.totalItems > 0 
        ? Number((inventorySummary.totalValue / inventorySummary.totalItems).toFixed(2))
        : 0;
    
    // Round total value
    inventorySummary.totalValue = Number(inventorySummary.totalValue.toFixed(2));

    res.status(200).json({
      status: 'success',
      data: inventorySummary
    });
    
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
};

// Get category-wise inventory value
exports.getCategoryWiseValue = async (req, res) => {
  try {
    const products = await Product.find();
    
    const categoryWiseSummary = {};

    products.forEach(product => {
      if (!categoryWiseSummary[product.category]) {
        categoryWiseSummary[product.category] = {
          totalProducts: 0,
          totalItems: 0,
          totalValue: 0,
          products: []
        };
      }

      const category = categoryWiseSummary[product.category];
      const productValue = product.currentStock * product.costPrice;

      // Update category statistics
      category.totalProducts += 1;
      category.totalItems += product.currentStock;
      category.totalValue += productValue;

      // Add product details
      category.products.push({
        name: product.name,
        stock: product.currentStock,
        costPrice: product.costPrice,
        value: Number(productValue.toFixed(2))
      });
    });

    // Round values and calculate percentages
    let grandTotal = 0;
    Object.values(categoryWiseSummary).forEach(category => {
      category.totalValue = Number(category.totalValue.toFixed(2));
      grandTotal += category.totalValue;
    });

    // Add percentage of total inventory for each category
    Object.values(categoryWiseSummary).forEach(category => {
      category.percentageOfTotal = Number(((category.totalValue / grandTotal) * 100).toFixed(2));
    });

    res.status(200).json({
      status: 'success',
      data: {
        grandTotal: Number(grandTotal.toFixed(2)),
        categories: categoryWiseSummary
      }
    });
    
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message,
    });
  }
}; 

exports.getInventoryIncomeStats = async (req, res) => {
  try {
    const { period = 'daily' } = req.query;
    const endDate = moment().endOf('day');
    let startDate;
    let groupByFormat;

    switch (period) {
      case 'weekly':
        startDate = moment().subtract(7, 'days').startOf('day');
        groupByFormat = '%Y-%m-%d';
        break;
      case 'monthly':
        startDate = moment().subtract(30, 'days').startOf('day');
        groupByFormat = '%Y-%m-%d';
        break;
      default: 
        startDate = moment().startOf('day');
        groupByFormat = '%H:00';
    }

    const incomeStats = await Bill.aggregate([
      {
        $match: {
          createdAt: {
            $gte: startDate.toDate(),
            $lte: endDate.toDate()
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupByFormat,
              date: "$createdAt"
            }
          },
          totalIncome: { $sum: "$totalCost" },
          totalBills: { $sum: 1 },
          averageTicketSize: { $avg: "$totalCost" }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 1,
          totalIncome: { $round: ["$totalIncome", 2] },
          totalBills: 1,
          averageTicketSize: { $round: ["$averageTicketSize", 2] }
        }
      }
    ]);

    // Fill in missing time slots with zero values
    const filledStats = fillMissingTimeSlots(incomeStats, startDate, endDate, period);

    res.status(200).json({
      status: 'success',
      data: {
        period,
        stats: filledStats
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};
// Helper function to fill missing time slots with zero values
function fillMissingTimeSlots(stats, startDate, endDate, period) {
  const filledStats = [];
  let currentDate = moment(startDate);
  const format = period === 'daily' ? 'HH:00' : 'YYYY-MM-DD';
  
  while (currentDate <= endDate) {
    const timeSlot = currentDate.format(format);
    const existingStat = stats.find(stat => stat._id === timeSlot);
    
    filledStats.push(
      existingStat || {
        _id: timeSlot,
        totalIncome: 0,
        totalBills: 0,
        averageTicketSize: 0
      }
    );

    if (period === 'daily') {
      currentDate.add(1, 'hour');
    } else {
      currentDate.add(1, 'day');
    }
  }

  return filledStats;
}

exports.getDailyIncomeStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = {};
    
    if (startDate && endDate) {
      query.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const dailyStats = await DailyIncome.find(query)
      .sort({ date: 1 });

    const stats = dailyStats.map(day => ({
      date: moment(day.date).format('YYYY-MM-DD'),
      totalIncome: day.totalIncome,
      billCount: day.billCount,
      paymentBreakdown: {
        cash: day.paymentMethods.cash,
        card: day.paymentMethods.card,
        upi: day.paymentMethods.upi
      }
    }));

    res.status(200).json({
      status: 'success',
      data: {
        stats
      }
    });
  } catch (error) {
    res.status(400).json({
      status: 'fail',
      message: error.message
    });
  }
};
