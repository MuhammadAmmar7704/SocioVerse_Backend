import express from 'express';
import cloudinary from 'cloudinary';
import multer from 'multer';

const router = express.Router();

cloudinary.config({
  cloud_name: 'dkjfmi5rz',
  api_key: '144496546383315',
  api_secret: 'AGTRewNvxosEQ3YT1Sb0FRIa9js',
});

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    cloudinary.v2.uploader.upload_stream(
      { folder: 'societyManagement' },
      (error, result) => {
        if (error) {
          return res.status(500).json({ success: false, error: error.message });
        }
        
        res.json({ success: true, url: result.secure_url });
      }
    ).end(req.file.buffer); 
  } catch (error) {
    console.error('Image upload failed:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
