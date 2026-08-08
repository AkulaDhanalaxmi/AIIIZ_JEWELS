const cloudinary = require('../config/cloudinary');

async function uploadImageFromBuffer(buffer, mimetype, folder='products'){
  const dataUri = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const result = await cloudinary.uploader.upload(dataUri, { folder });
  return result;
}

exports.upload = async (req, res) => {
  try{
    if(!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const folder = String(req.body.folder || req.query.folder || 'products').trim() || 'products';
    const result = await uploadImageFromBuffer(req.file.buffer, req.file.mimetype, folder);
    return res.json({ url: result.secure_url, secure_url: result.secure_url, raw: result });
  }catch(e){
    console.error('Upload error', e && e.message ? e.message : e);
    return res.status(500).json({ message: 'Could not upload image' });
  }
};
