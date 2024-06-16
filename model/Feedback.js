const mongoose = require("mongoose");
const moment = require("moment-timezone");

const feedbackSchema = new mongoose.Schema(
  {
    comment: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    feedbackDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  { timestamps: true }
);

feedbackSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.feedbackDate = moment(obj.feedbackDate).tz("Asia/Bangkok").format();
  obj.createdAt = moment(obj.createdAt).tz("Asia/Bangkok").format();
  obj.updatedAt = moment(obj.updatedAt).tz("Asia/Bangkok").format();
  return obj;
};

module.exports = mongoose.model("Feedback", feedbackSchema);
