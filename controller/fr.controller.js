const FRModel = require("../model/FR");
const path = require("path");
const { spawn } = require("child_process");
const axios = require("axios");

const uploadFR = async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ success: false, msg: "No file uploaded." });
    }

    const filePath = file.path;
    const scriptPath = path.resolve(__dirname, "../script/process_extractguest.py");
    const args = [scriptPath, filePath];

    const child = spawn("python", args);

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("close", async (code) => {
      if (code !== 0) {
        console.error("Error in Python script:", stderr);
        return res.status(500).json({ success: false, msg: "Python script failed." });
      }

      try {
        const cleanedData = JSON.parse(stdout);

        const newFile = new FRModel({
          fileName: file.filename,
          filePath: filePath,
          data: cleanedData,
        });

        await newFile.save();

        try {
          const response = await axios.post(
            "http://localhost:8080/api/v1/dags/etl_file_processing/dagRuns",
            { conf: {} },
            { auth: { username: "admin", password: "admin" } }
          );

          console.log("Airflow DAG triggered successfully:", response.data);
          res.status(200).json({
            success: true,
            msg: "File uploaded, processed, and DAG triggered.",
          });
        } catch (error) {
          console.error("Error triggering Airflow DAG:", error.response?.data || error.message);
          res.status(500).json({ success: false, msg: "Failed to trigger Airflow DAG." });
        }
      } catch (error) {
        console.error("Error parsing Python script output:", error);
        res.status(500).json({ success: false, msg: "Error processing file." });
      }
    });
  } catch (error) {
    console.error("Server Error:", error.message);
    res.status(500).json({ success: false, msg: "Server error." });
  }
};

const deleteFR = async (req, res) => {
  try {
    const { fileId } = req.params;

    const fileToDelete = await FRModel.findById(fileId);
    if (!fileToDelete) {
      return res.status(404).json({ success: false, msg: "File not found." });
    }

    await FRModel.findByIdAndDelete(fileId);

    await FRModel.deleteOne({ filePath: fileToDelete.filePath });

    const response = await axios.post(
      "http://localhost:8080/api/v1/dags/etl_file_processing/dagRuns",
      { conf: {} },
      { auth: { username: "admin", password: "admin" } }
    );

    res.status(200).json({ success: true, msg: "File and corresponding ETL data deleted successfully." });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ success: false, msg: "Error deleting file." });
  }
};

module.exports = { uploadFR, deleteFR };
