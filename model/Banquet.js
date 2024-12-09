const mongoose = require('mongoose');

const BanquetSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('ModelBanquet', BanquetSchema);
