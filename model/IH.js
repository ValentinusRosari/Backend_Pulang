const mongoose = require('mongoose');

const IhSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('IhModel', IhSchema);
