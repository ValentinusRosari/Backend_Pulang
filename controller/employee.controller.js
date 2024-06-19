const Employee = require("../model/Employee");

const createEmployee = async (req, res) => {
  try {
    const employee = new Employee({ ...req.body });

    await employee.save();

    res.status(201).json({ succes: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEmployee = async (req, res) => {
  try {
    const employee = await Employee.find();

    res.status(200).json({ succes: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEmployeeByName = async (req, res) => {
  try {
    const { employeeName } = req.query;

    if (!employeeName) {
      return res
        .status(400)
        .json({ success: false, message: "Employee name is required" });
    }

    const employee = await Employee.findOne({ employeeName });

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const updatedData = { ...req.body };

    const employee = await Employee.findOneAndUpdate(
      { _id: employeeId },
      updatedData,
      {
        new: true,
      }
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee record not found" });
    }

    res.status(200).json({ succes: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const employee = await Employee.findOneAndDelete({ _id: employeeId });

    res.status(200).json({ success: true, data: "Employee removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createEmployee,
  readEmployee,
  readEmployeeByName,
  updateEmployee,
  deleteEmployee,
};
