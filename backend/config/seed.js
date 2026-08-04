// Run with: npm run seed
// Populates the database with sample categories, products and an admin user.
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./db');
const Category = require('../models/Category');
const Product = require('../models/Product');
const User = require('../models/User');
const Review = require('../models/Review');

const categories = [
  { name: 'Bangles', slug: 'bangles', icon: 'bangle' },
  { name: 'Necklaces', slug: 'necklaces', icon: 'necklace' },
  { name: 'Earrings', slug: 'earrings', icon: 'earring' },
  { name: 'Rings', slug: 'rings', icon: 'ring' },
  { name: 'Bracelets', slug: 'bracelets', icon: 'bracelet' },
];

async function run() {
  await connectDB();

  await Category.deleteMany({});
  await Product.deleteMany({});
  await Review.deleteMany({});

  const createdCategories = await Category.insertMany(categories);
  const byName = (name) => createdCategories.find((c) => c.name === name)._id;

  const createdProducts = await Product.insertMany([
    // Bangles (5)
    { name: 'Heritage Gold Bangle Set', category: byName('Bangles'), price: 41990, mrp: 47990, material: '22K Gold', occasion: 'Festive', weight: '18g', description: 'Intricately engraved heritage bangles.', stock: 15, image: '', isFeatured: true },
    { name: 'Antique Temple Bangles', category: byName('Bangles'), price: 47990, mrp: 54990, material: '22K Gold', occasion: 'Wedding', weight: '22g', description: 'Temple-motif handcrafted bangles.', stock: 8, image: '' },
    { name: 'Slim Everyday Bangle', category: byName('Bangles'), price: 15990, mrp: 18990, material: '18K Gold', occasion: 'Daily Wear', weight: '6g', description: 'Slim lightweight bangle for daily wear.', stock: 22, image: '' },
    { name: 'Studded Kada', category: byName('Bangles'), price: 19990, mrp: 22990, material: '18K Gold', occasion: 'Party', weight: '10g', description: 'Kada with stone studs.', stock: 12, image: '' },
    { name: 'Minimal Thin Bangle', category: byName('Bangles'), price: 8990, mrp: 11990, material: '18K Gold', occasion: 'Daily Wear', weight: '3g', description: 'Minimal thin bangle.', stock: 30, image: '' },

    // Necklaces (5)
    { name: 'Floral Diamond Pendant', category: byName('Necklaces'), price: 28990, mrp: 34990, material: '18K Gold, Diamond', occasion: 'Daily Wear', weight: '3.2g', description: 'Delicate floral pendant with diamonds.', stock: 18, image: '', isFeatured: true },
    { name: 'Pearl Drop Necklace', category: byName('Necklaces'), price: 22990, mrp: 26990, material: '18K Gold, Pearl', occasion: 'Daily Wear', weight: '4g', description: 'Freshwater pearl drop necklace.', stock: 14, image: '' },
    { name: 'Bridal Choker Necklace', category: byName('Necklaces'), price: 64990, mrp: 74990, material: '22K Gold, Kundan', occasion: 'Wedding', weight: '28g', description: 'Opulent bridal choker with kundan work.', stock: 5, image: '' },
    { name: 'Layered Chain Set', category: byName('Necklaces'), price: 17990, mrp: 21990, material: '18K Gold', occasion: 'Party', weight: '7g', description: 'Layered chain necklace set.', stock: 20, image: '' },
    { name: 'Locket Classic', category: byName('Necklaces'), price: 10990, mrp: 12990, material: '18K Gold', occasion: 'Daily Wear', weight: '5g', description: 'Classic locket with engraving.', stock: 25, image: '' },

    // Earrings (5)
    { name: 'Royal Drop Earrings', category: byName('Earrings'), price: 29990, mrp: 36990, material: '22K Gold, Kundan', occasion: 'Wedding', weight: '6.5g', description: 'Statement royal drop earrings.', stock: 9, image: '', isFeatured: true },
    { name: 'Kundan Jhumka Earrings', category: byName('Earrings'), price: 18990, mrp: 22990, material: '22K Gold, Kundan', occasion: 'Festive', weight: '8g', description: 'Traditional jhumka earrings.', stock: 20, image: '' },
    { name: 'Minimal Diamond Studs', category: byName('Earrings'), price: 12990, mrp: 15990, material: '18K Gold, Diamond', occasion: 'Daily Wear', weight: '1.6g', description: 'Understated diamond studs.', stock: 30, image: '' },
    { name: 'Hoop Elegance', category: byName('Earrings'), price: 9990, mrp: 11990, material: '18K Gold', occasion: 'Daily Wear', weight: '4g', description: 'Classic hoop earrings.', stock: 40, image: '' },
    { name: 'Pearl Cluster Drops', category: byName('Earrings'), price: 14990, mrp: 17990, material: '18K Gold, Pearl', occasion: 'Party', weight: '5g', description: 'Clustered pearl drop earrings.', stock: 16, image: '' },

    // Rings (5)
    { name: 'Classic Solitaire Ring', category: byName('Rings'), price: 34990, mrp: 39990, material: '18K Gold, Diamond', occasion: 'Engagement', weight: '2.8g', description: 'Timeless solitaire ring.', stock: 12, image: '', isFeatured: true },
    { name: 'Emerald Halo Ring', category: byName('Rings'), price: 38990, mrp: 44990, material: '18K Gold, Emerald', occasion: 'Party', weight: '3.1g', description: 'Emerald halo ring with diamonds.', stock: 10, image: '' },
    { name: 'Stackable Band Set', category: byName('Rings'), price: 12990, mrp: 14990, material: '18K Gold', occasion: 'Daily Wear', weight: '2g', description: 'Set of three stackable bands.', stock: 28, image: '' },
    { name: 'Signet Ring', category: byName('Rings'), price: 17990, mrp: 19990, material: '18K Gold', occasion: 'Party', weight: '5g', description: 'Classic signet ring.', stock: 14, image: '' },
    { name: 'Delicate Midi Ring', category: byName('Rings'), price: 4990, mrp: 6990, material: '18K Gold', occasion: 'Daily Wear', weight: '0.8g', description: 'Delicate midi ring for stacking.', stock: 50, image: '' },

    // Bracelets (5)
    { name: 'Diamond Cuff Bracelet', category: byName('Bracelets'), price: 52990, mrp: 61990, material: '18K Gold, Diamond', occasion: 'Party', weight: '12g', description: 'Bold cuff bracelet with diamonds.', stock: 6, image: '', isFeatured: true },
    { name: 'Twin Charm Bracelet', category: byName('Bracelets'), price: 15990, mrp: 18990, material: '18K Gold', occasion: 'Daily Wear', weight: '2.4g', description: 'Twin charm delicate bracelet.', stock: 17, image: '' },
    { name: 'Chain Bracelet', category: byName('Bracelets'), price: 8990, mrp: 10990, material: '18K Gold', occasion: 'Daily Wear', weight: '3g', description: 'Classic chain bracelet.', stock: 22, image: '' },
    { name: 'Beaded Stretch Bracelet', category: byName('Bracelets'), price: 3990, mrp: 4990, material: 'Gold Plated', occasion: 'Casual', weight: '1g', description: 'Beaded stretch bracelet.', stock: 60, image: '' },
    { name: 'Charm Bangle', category: byName('Bracelets'), price: 12990, mrp: 14990, material: '18K Gold', occasion: 'Gift', weight: '4g', description: 'Bangle with removable charms.', stock: 15, image: '' },
  ]);

  const adminExists = await User.findOne({ email: 'admin@aiiz.com' });
  if (!adminExists) {
    await User.create({ name: 'Aiiz Admin', email: 'admin@aiiz.com', password: 'aiiz123', role: 'admin' });
    console.log('Admin user created: admin@aiiz.com / aiiz123');
  }

  // A demo customer + a couple of sample reviews so the "Reviews" section on the
  // product page has something to show out of the box.
  let demoUser = await User.findOne({ email: 'demo@aiiz.com' });
  if (!demoUser) {
    demoUser = await User.create({ name: 'Ananya Sharma', email: 'demo@aiiz.com', password: 'demo1234', role: 'customer' });
  }
  const byProductName = (name) => createdProducts.find((p) => p.name === name);
  const sampleReviews = [
    { product: byProductName('Floral Diamond Pendant'), rating: 5, comment: 'Absolutely gorgeous — looks even better in person. Delivery was quick too!' },
    { product: byProductName('Kundan Jhumka Earrings'), rating: 4, comment: 'Beautiful festive earrings, slightly heavier than expected but worth it.' },
    { product: byProductName('Heritage Gold Bangle Set'), rating: 5, comment: 'Exceptional craftsmanship. Got so many compliments at my sister\'s wedding.' },
  ];
  for (const r of sampleReviews) {
    if (!r.product) continue;
    await Review.create({ product: r.product._id, user: demoUser._id, name: demoUser.name, rating: r.rating, comment: r.comment });
    const reviews = await Review.find({ product: r.product._id });
    const avg = reviews.reduce((s, rv) => s + rv.rating, 0) / reviews.length;
    await Product.findByIdAndUpdate(r.product._id, { rating: Math.round(avg * 10) / 10, numReviews: reviews.length });
  }

  console.log('Seed complete.');
  await mongoose.connection.close();
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
