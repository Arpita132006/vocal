const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({

  email: String,

  otp: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },

});

module.exports =
mongoose.model("OTPLog", otpSchema);