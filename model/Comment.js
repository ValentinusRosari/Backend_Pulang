const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model('ModelComment', CommentSchema);
