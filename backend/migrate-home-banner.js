require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Setting = require('./models/Setting');

async function migrate(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  const s = await Setting.findOne({ key: 'home_banner' });
  if(!s || !s.value){
    console.log('No home_banner setting found');
    await mongoose.disconnect();
    process.exit(0);
  }
  const value = s.value;
  const img = value.image;
  if(!img){
    console.log('home_banner has no image');
    await mongoose.disconnect();
    process.exit(0);
  }
  const isUrl = typeof img === 'string' && img.startsWith('http');
  const isData = typeof img === 'string' && img.startsWith('data:image');
  console.log('Before: isUrl=', isUrl, 'isData=', isData);
  if(isUrl){
    console.log('Already URL, no action');
    await mongoose.disconnect();
    process.exit(0);
  }
  if(typeof img === 'string' && img.length > 200){
    try{
      const dataUri = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
      const res = await cloudinary.uploader.upload(dataUri, { folder: 'home_banner' });
      value.image = res.secure_url;
      s.value = value;
      await s.save({ validateBeforeSave:false });
      console.log('Uploaded home_banner image and updated setting');
      console.log('After: url=', res.secure_url);
    }catch(e){
      console.error('Failed to upload home_banner image:', e.message || e);
    }
  } else {
    console.log('No long data URL detected; nothing to do');
  }
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(err=>{ console.error('Migration failed', err); process.exit(1); });
