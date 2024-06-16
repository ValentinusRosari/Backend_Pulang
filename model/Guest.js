const mongoose = require("mongoose");

const guestSchema = new mongoose.Schema({
  guestName: {
    type: String,
    required: true,
  },
  waNumber: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Guest", guestSchema);
