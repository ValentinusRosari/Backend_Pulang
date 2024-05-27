const mongoose = require("mongoose");
process.env.TZ = "Asia/Bangkok";

const eventSchema = new mongoose.Schema(
  {
    checkInDate: {
      type: Date,
      default: Date.now,
    },
    checkOutDate: {
      type: Date,
    },
    arrangement: {
      type: String,
      required: true,
    },
    guestCategory: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
