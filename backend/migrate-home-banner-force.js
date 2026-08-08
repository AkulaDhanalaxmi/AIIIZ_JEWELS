require('dotenv').config();
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const Setting = require('./models/Setting');

async function migrate(){
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB (force)');
  const s = await Setting.findOne({ key: 'home_banner' }).lean();
  if(!s || !s.value){
    console.log('No home_banner setting found');
    await mongoose.disconnect(); process.exit(0);
  }
  const value = s.value;
  const img = value.image;
  if(!img){ console.log('no image'); await mongoose.disconnect(); process.exit(0); }
  if(typeof img === 'string' && (img.startsWith('data:image') || img.length>200)){
    try{
      const dataUri = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
      const res = await cloudinary.uploader.upload(dataUri, { folder: 'home_banner' });
      const newValue = Object.assign({}, value, { image: res.secure_url });
      const updated = await Setting.findOneAndUpdate({ key: 'home_banner' }, { value: newValue }, { new: true });
      console.log('Updated setting with cloudinary url:', res.secure_url);
    }catch(e){ console.error('upload failed', e); }
  } else {
    console.log('No upload needed');
  }
  await mongoose.disconnect(); process.exit(0);
}
migrate().catch(e=>{ console.error(e); process.exit(1); });
