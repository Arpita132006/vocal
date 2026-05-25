const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({

  email: String,

  name: String,

  age: Number,

  gender: String,

  languages:[String],



});

module.exports =
mongoose.model("User", userSchema);