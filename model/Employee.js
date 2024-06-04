const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeName: {
    type: String,
    required: true,
  },
  employeeDepartment: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("Employee", employeeSchema);
