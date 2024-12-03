const mongoose = require("mongoose");

const frSchema = new mongoose.Schema({
  fileName: { type: String },
  filePath: { type: String },
  data: { type: Array },
});

module.exports = mongoose.model("FrModel", frSchema);
