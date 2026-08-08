require('dotenv').config();
const mongoose = require('mongoose');
const Category = require('./models/Category');

async function run(){
  try{
    const uri = process.env.MONGO_URI;
    if(!uri){
      console.error('MONGO_URI not set in environment');
      process.exit(2);
    }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');
    const cats = await Category.find({}).select('name image').lean();
    console.log(`Found ${cats.length} categories`);
    for(const c of cats){
      const img = c.image || '';
      const isData = typeof img === 'string' && img.startsWith('data:image');
      const isCloud = typeof img === 'string' && img.startsWith('https://res.cloudinary.com');
      console.log(`- ${c.name} | image startsWith data:image: ${isData} | startsWith cloudinary: ${isCloud}`);
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
