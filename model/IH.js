const mongoose = require('mongoose');

const IhSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    filePath: { type: String, required: true },
    data: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ModelIh', IhSchema);
