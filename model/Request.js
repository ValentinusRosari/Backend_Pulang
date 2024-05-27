const mongoose = require("mongoose");
process.env.TZ = "Asia/Bangkok";

const requestSchema = new mongoose.Schema({
  item: {
    type: String,
    required: true,
  },
  quantity: {
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
