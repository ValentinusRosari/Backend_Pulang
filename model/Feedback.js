const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
  comment: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Feedback", feedbackSchema);
