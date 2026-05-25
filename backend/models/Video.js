const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({

  email: String,

  videoUrl: String,

  caption: String,

  language: String,

  likes: {
    type: Number,
    default: 0,
  },

  comments: {
    type: Number,
    default: 0,
  },

  shares: {
    type: Number,
    default: 0,
  },

  uploadedAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports =
mongoose.model("Video", videoSchema);