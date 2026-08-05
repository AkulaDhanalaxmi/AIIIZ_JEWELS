require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2; // auto-configures from CLOUDINARY_URL
const Product = require('./models/Product');

async function migrate() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const products = await Product.find({});
  console.log(`Found ${products.length} products to check`);

  for (const product of products) {
    if (!product.images || product.images.length === 0) continue;

    const newImages = [];
    let changed = false;

    for (const img of product.images) {
      if (typeof img === 'string' && img.startsWith('http')) {
        newImages.push(img); // already migrated
        continue;
      }

      if (typeof img === 'string' && img.length > 200) {
        try {
          const dataUri = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
          const result = await cloudinary.uploader.upload(dataUri, { folder: 'products' });
          newImages.push(result.secure_url);
          changed = true;
          console.log(`Uploaded image for product ${product._id}`);
        } catch (err) {
          console.error(`Failed to upload image for ${product._id}:`, err.message);
          newImages.push(img);
        }
      } else {
        newImages.push(img);
      }
    }

    if (changed) {
      product.images = newImages;
      await product.save({ validateBeforeSave: false });
      console.log(`Updated product ${product._id}`);
    }
  }

  console.log('Migration complete');
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});