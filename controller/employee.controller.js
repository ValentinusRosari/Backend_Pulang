const Employee = require("../model/Employee");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createEmployee = async (req, res) => {
  try {
    const employee = new Employee({ ...req.body });

    await employee.save();
    await delAsync('allEmployees');

    res.status(201).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEmployee = async (req, res) => {
  const cacheKey = 'allEmployees';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const employees = await Employee.find();
    await setAsync(cacheKey, JSON.stringify(employees), 'EX', 3600);

    res.status(200).json({ success: true, data: employees });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEmployeeByName = async (req, res) => {
  const { employeeName } = req.query;
  const cacheKey = `employeeByName:${employeeName}`;

  if (!employeeName) {
    return res.status(400).json({ success: false, message: "Employee name is required" });
  }

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const employee = await Employee.findOne({ employeeName });
    if (!employee) {
      return res.status(404).json({ success: false, message: "Employee not found" });
    }

    await setAsync(cacheKey, JSON.stringify(employee), 'EX', 3600);

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;
    const updatedData = { ...req.body };

    const employee = await Employee.findOneAndUpdate({ _id: employeeId }, updatedData, { new: true });
    if (!employee) {
      return res.status(404).json({ message: "Employee record not found" });
    }

    await delAsync('allEmployees');
    await delAsync(`employeeByName:${employee.employeeName}`);

    res.status(200).json({ success: true, data: employee });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const employee = await Employee.findOneAndDelete({ _id: employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    await delAsync('allEmployees');
    await delAsync(`employeeByName:${employee.employeeName}`);

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
