const mongoose = require("mongoose");

const identitySchema = new mongoose.Schema({
  cardType: {
    type: String,
    required: true,
  },
  cardNumber: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Identity", identitySchema);
