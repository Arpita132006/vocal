const express = require('express');

const router = express.Router();

const multer = require('multer');

const {
  CloudinaryStorage
} = require(
  'multer-storage-cloudinary'
);

const cloudinary =
require('../cloudinary');

const Video =
require('../models/Video');

// CLOUDINARY STORAGE
const storage =
new CloudinaryStorage({

  cloudinary,

  params: {

    folder: 'vocalize_videos',

    resource_type: 'video',

  },

});

const upload =
multer({ storage });

// UPLOAD VIDEO
router.post(
  '/upload-video',

  upload.single('video'),

  async (req, res) => {

    try {

      const {
        email,
        caption,
        language,
      } = req.body;

      const newVideo =
      new Video({

        email,

        caption,

        language,

        videoUrl:
        req.file.path,

      });

      await newVideo.save();

      res.json({

        success: true,

        video:
        newVideo,

      });

    } catch (err) {

      console.log(err);

      res.json({

        success: false,

      });

    }

  }

);

module.exports = router;