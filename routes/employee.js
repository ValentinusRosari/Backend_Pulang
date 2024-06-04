const express = require("express");
const router = express.Router();
const employeeController = require("../controller/employee.controller");

router.post("/", employeeController.createEmployee);
router.get("/", employeeController.readEmployee);
router.patch("/:id", employeeController.updateEmployee);
router.delete("/:id", employeeController.deleteEmployee);

module.exports = router;
