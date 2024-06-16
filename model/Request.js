const mongoose = require("mongoose");
const moment = require("moment-timezone");

const requestSchema = new mongoose.Schema(
  {
    item: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      required: true,
    },
    requestTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    executionTime: {
      type: Date,
    },
    returnDate: {
      type: Date,
    },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true }
);

requestSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.requestTime = moment(obj.requestTime).tz("Asia/Bangkok").format();
  obj.executionTime = obj.executionTime
    ? moment(obj.executionTime).tz("Asia/Bangkok").format()
    : null;
  obj.createdAt = moment(obj.createdAt).tz("Asia/Bangkok").format();
  obj.updatedAt = moment(obj.updatedAt).tz("Asia/Bangkok").format();
  return obj;
};

module.exports = mongoose.model("Request", requestSchema);
