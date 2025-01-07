const mongoose = require("mongoose");

const frSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    filePath: { type: String },
    data: { type: Array },
  }, 
  { timestamps: true }
);

module.exports = mongoose.model("ModelFr", frSchema);
