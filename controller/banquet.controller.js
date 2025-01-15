const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require("axios");
const BANQUETModel = require('../model/Banquet');
require("dotenv").config();

const uploadBANQUET = async (req, res) => {
    try {
        const file = req.file;

        if (!file) {
            return res.status(400).send({ success: false, msg: 'No file uploaded.' });
        }

        const filePath = file.path;
        const scriptPath = path.resolve(__dirname, "../script/process_banquet.py");
        const args = [scriptPath, filePath];

        const child = spawn('python', args);

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', async (code) => {
            if (code !== 0) {
                console.error(`Child process exited with code ${code}`);
                console.error(`stderr: ${stderr}`);
                return res.status(400).send({ success: false, msg: `Exec error: ${stderr}` });
            }

            try {
                if (!stdout) {
                    return res.status(400).send({ success: false, msg: 'No output received from the Python script.' });
                }

                let output;
                try {
                    output = JSON.parse(stdout);
                } catch (jsonError) {
                    console.error('Error parsing JSON:', jsonError);
                    return res.status(400).send({ success: false, msg: 'Invalid JSON returned from Python script.' });
                }

                if (output.error) {
                    console.error('Python script error:', output.error);
                    return res.status(400).send({ success: false, msg: `Python script error: ${output.error}` });
                }

                console.time('DatabaseUploadTime');

                const Document = new BANQUETModel({
                    fileName: file.filename,
                    filePath: file.path,
                    data: output,
                });

                await Document.save();

                console.timeEnd('DatabaseUploadTime');

                fs.unlink(file.path, (err) => {
                    if (err) {
                        console.error('Error removing file', err);
                    }
                });

                try {
                    const response = await axios.post(
                        `${process.env.AIRFLOW_BASE_URL}/api/v1/dags/cashier_file_processing/dagRuns`,
                        { conf: {} },
                        {
                            auth: {
                                username: process.env.AIRFLOW_USERNAME,
                                password: process.env.AIRFLOW_PASSWORD,
                            },
                        }
                    );

                    console.log("Airflow DAG triggered successfully:", response.data);
                    res.send({ status: 200, success: true, msg: 'File uploaded and CSV data has been imported successfully!' });
                } catch (error) {
                    console.error("Error triggering Airflow DAG:", error);
                    res.status(500).send({ success: false, msg: 'Failed to trigger Airflow DAG.' });
                }

            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                res.status(500).send({ success: false, msg: 'Internal server error.' });
            }
        });
    } catch (error) {
        console.error('Unexpected server error:', error);
        res.status(500).send({ success: false, msg: error.message });
    }
};

const deleteBANQUET = async (req, res) => {
    try {
        const { fileId } = req.params;

        const fileToDelete = await BANQUETModel.findById(fileId);
        if (!fileToDelete) {
            return res.status(404).json({ success: false, msg: "File not found." });
        }

        await BANQUETModel.findByIdAndDelete(fileId);

        try {
            const response = await axios.post(
                `${process.env.AIRFLOW_BASE_URL}/api/v1/dags/cashier_file_processing/dagRuns`,
                { conf: {} },
                {
                    auth: {
                        username: process.env.AIRFLOW_USERNAME,
                        password: process.env.AIRFLOW_PASSWORD,
                    },
                }
            );

            res.status(200).json({ success: true, msg: "File and corresponding ETL data deleted successfully." });
        } catch (error) {
            console.error("Error triggering Airflow DAG:", error);
            res.status(500).json({ success: false, msg: "Failed to trigger Airflow DAG." });
        }
    } catch (error) {
        console.error("Error deleting file:", error);
        res.status(500).json({ success: false, msg: "Error deleting file." });
    }
};

const getBANQUET = async (req, res) => {
    try {
        const files = await BANQUETModel.find().select("-data");
        if (!files || files.length === 0) {
            return res.status(404).json({ success: false, msg: "No files found." });
        }
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        console.error("Error fetching files:", error);
        res.status(500).json({ success: false, msg: "Error fetching files." });
    }
};

module.exports = { uploadBANQUET, deleteBANQUET, getBANQUET };
