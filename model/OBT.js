const mongoose = require("mongoose");

const obtSchema = new mongoose.Schema(
  {
    fileName: { type: String },
    filePath: { type: String },
    data: { type: Array },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ModelObt", obtSchema);
