require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/Product');

async function run(){
  try{
    const uri = process.env.MONGO_URI;
    if(!uri){
      console.error('MONGO_URI not set in environment');
      process.exit(2);
    }
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    const products = await Product.find({}).select('name images').lean();
    console.log(`Found ${products.length} products`);
    for(const p of products){
      const img0 = (p.images && p.images[0]) || '';
      const isData = typeof img0 === 'string' && img0.startsWith('data:image');
      const isCloud = typeof img0 === 'string' && img0.startsWith('https://res.cloudinary.com');
      console.log(`- ${p.name} | images[0] startsWith data:image: ${isData} | startsWith cloudinary: ${isCloud}`);
    }
    await mongoose.disconnect();
    process.exit(0);
  }catch(e){
    console.error('Error:', e && e.message ? e.message : e);
    try{ await mongoose.disconnect(); }catch(_){}
    process.exit(1);
  }
}
run();
