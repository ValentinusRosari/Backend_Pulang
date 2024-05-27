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
  plateNumber: {
    type: String,
  },
  guestAge: {
    type: String,
    required: true,
  },
  guestGender: {
    type: String,
    required: true,
  },
  guestOccupation: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Guest", guestSchema);
