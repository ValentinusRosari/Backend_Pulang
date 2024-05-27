const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
  },
  roomType: {
    type: String,
    required: true,
  },
  roomFloor: {
    type: Number,
    required: true,
  },
  roomCapacity: {
    type: Number,
    required: true,
  },
});

module.exports = mongoose.model("Room", roomSchema);
