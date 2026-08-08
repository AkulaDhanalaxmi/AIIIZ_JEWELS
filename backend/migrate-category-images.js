require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Category = require('./models/Category');

async function migrate(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const cats = await Category.find({});
  console.log(`Found ${cats.length} categories to check`);
  let changedCount = 0;
  for(const c of cats){
    const img = c.image;
    if(!img) continue;
    if(typeof img === 'string' && img.startsWith('http')){
      // already URL
      continue;
    }
    if(typeof img === 'string' && img.length > 200){
      try{
        const dataUri = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
        const res = await cloudinary.uploader.upload(dataUri, { folder: 'categories' });
        c.image = res.secure_url;
        await c.save({ validateBeforeSave:false });
        changedCount++;
        console.log(`Uploaded and updated category ${c._id}`);
      }catch(e){
        console.error(`Failed to upload category ${c._id}:`, e.message || e);
      }
    }
  }
  console.log(`Migration complete. Updated ${changedCount} categories.`);
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err=>{ console.error('Migration failed', err); process.exit(1); });
