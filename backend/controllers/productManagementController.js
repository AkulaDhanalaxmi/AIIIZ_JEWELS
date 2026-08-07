const Product = require('../models/Product');
const logger = require('../utils/logger');

// Admin: Update product stock
async function adminUpdateProductStock(req, res, next) {
  try {
    const { stock, stockStatus } = req.body;
    
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (stock !== undefined) {
      product.stock = stock;
      // Auto-determine stock status if not explicitly provided
      if (!stockStatus) {
        if (stock === 0) product.stockStatus = 'out-of-stock';
        else if (stock < 5) product.stockStatus = 'low-stock';
        else product.stockStatus = 'in-stock';
      }
    }

    if (stockStatus) product.stockStatus = stockStatus;

    await product.save();
    logger.info('Product stock updated', { productId: product._id, stock, stockStatus: product.stockStatus });
    res.json({ success: true, message: 'Product stock updated', data: product });
  } catch (error) {
    logger.error('Error updating product stock', { error: error.message });
    res.status(500).json({ success: false, message: 'Error updating product stock' });
  }
}

// Admin: Get all products with stock info
async function adminGetAllProducts(req, res, next) {
  try {
    const { stockStatus, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (stockStatus) filter.stockStatus = stockStatus;

    const skip = (Number(page) - 1) * Number(limit);
    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({
      success: true,
      data: products,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)), limit: Number(limit) }
    });
  } catch (error) {
    logger.error('Error fetching products', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching products' });
  }
}

// Admin: Get product detail
async function adminGetProductDetail(req, res, next) {
  try {
    const product = await Product.findById(req.params.id).populate('category');
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    res.json({ success: true, data: product });
  } catch (error) {
    logger.error('Error fetching product', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
}

// User: Get product (with stock info)
async function getUserProduct(req, res, next) {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category');
    
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
    
    res.json({ success: true, data: product });
  } catch (error) {
    logger.error('Error fetching product', { error: error.message });
    res.status(500).json({ success: false, message: 'Error fetching product' });
  }
}

module.exports = {
  adminUpdateProductStock,
  adminGetAllProducts,
  adminGetProductDetail,
  getUserProduct,
};
