const User = require('../models/User');

// GET /api/wishlist
exports.getWishlist = async (req, res) => {
  const user = await User.findById(req.user._id).select('wishlist').populate('wishlist', 'name price stock images');
  res.json({ wishlist: user.wishlist });
};

// POST /api/wishlist/:productId
exports.addToWishlist = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $addToSet: { wishlist: req.params.productId } },
    { new: true, select: 'wishlist' }
  ).populate('wishlist', 'name price stock images');
  res.json({ wishlist: user.wishlist });
};

// DELETE /api/wishlist/:productId
exports.removeFromWishlist = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $pull: { wishlist: req.params.productId } },
    { new: true, select: 'wishlist' }
  ).populate('wishlist', 'name price stock images');
  res.json({ wishlist: user.wishlist });
};
