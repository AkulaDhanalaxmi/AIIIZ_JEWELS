require('dotenv').config();
const mongoose = require('mongoose');
const Setting = require('./models/Setting');
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const setting = await Setting.findOne({ key: 'delivery_settings' }).lean();
    console.log(JSON.stringify(setting, null, 2));
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
})();
