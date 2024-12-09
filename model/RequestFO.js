const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('ModelRequest', RequestSchema);
