const mongoose = require("mongoose");

const requestSchema = new mongoose.Schema({
  item: {
    type: String,
    required: true,
  },
  quantity: {
    type: String,
    required: true,
  },
  item: {
    type: String,
    required: true,
  },
  requestTime: {
    type: Date,
    required: true,
    default: Date.now,
  },
  executionTime: {
    type: Date,
  },
});

module.exports = mongoose.model("Request", requestSchema);
