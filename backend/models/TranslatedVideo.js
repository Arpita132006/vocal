const mongoose = require('mongoose');

const translatedVideoSchema =
new mongoose.Schema({

  email: String,

  originalVideoUrl: String,

  translatedVideoUrl: String,

  translatedText: String,

  fromLanguage: String,

  toLanguage: String,

  status: {
    type: String,
    enum: ['processing', 'completed', 'failed'],
    default: 'processing',
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports =
mongoose.model(
  "TranslatedVideo",
  translatedVideoSchema
);