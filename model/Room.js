const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
  },
  roomType: {
    type: String,
  },
  roomFloor: {
    type: Number,
  },
  roomCapacity: {
    type: Number,
  },
});

module.exports = mongoose.model("Room", roomSchema);
