const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const CombinedModel = require('../model/Filevhp');

const uploadAndImport = async (req, res) => {
    try {
        const file = req.file; // Expecting a single file upload

        if (!file) {
            return res.status(400).send({ success: false, msg: 'No file uploaded.' });
        }

        const filePath = file.path;
        let scriptPath;
        let args;

        // Path to the sample file
        const sampleFilePath = path.resolve(__dirname, '../components/InHouse-Guest JAN.csv');

        // Determine which script to run based on the file name or type
        if (file.originalname.includes('Maret') || file.originalname.includes('januari') || file.originalname.includes('Februari') || file.originalname.includes('InHouse')) {
            scriptPath = path.resolve(__dirname, '../script/process_inhousefile.py');
            args = [scriptPath, sampleFilePath, filePath];
        } else if (file.originalname.includes('Extract')) {
            scriptPath = path.resolve(__dirname, '../script/process_extractguess.py');
            args = [scriptPath, filePath];
        } else {
            return res.status(400).send({ success: false, msg: 'Unknown file type.' });
        }

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
                const output = JSON.parse(stdout);

                if (output.error) {
                    console.error(`Processing error: ${output.error}`);
                    return res.status(400).send({ success: false, msg: `Processing error: ${output.error}` });
                }

                const combinedDocument = new CombinedModel({
                    file: {
                        fileName: file.originalname,
                        filePath: file.path,
                        file: file.filename
                    },
                    data: output
                });

                await combinedDocument.save();

                fs.unlink(file.path, (err) => {
                    if (err) {
                        console.error('Error removing file', err);
                    }
                });

                res.send({ status: 200, success: true, msg: 'File uploaded and CSV data has been imported successfully!' });
            } catch (jsonError) {
                console.error('Error parsing JSON:', jsonError);
                res.status(500).send({ success: false, msg: 'Internal server error.' });
            }
        });
    } catch (error) {
        res.status(400).send({ success: false, msg: error.message });
    }
};

const home = async (req, res) => {
    try {
        const files = await CombinedModel.find({}, { file: 1 });
        res.status(200).json({ success: true, data: files });
    } catch (error) {
        console.error('Error fetching files:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await CombinedModel.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ success: false, msg: 'Document not found' });
        }

        res.status(200).json({ success: true, msg: 'Document deleted successfully' });
    } catch (error) {
        console.error('Error deleting document:', error);
        res.status(500).json({ success: false, msg: 'Internal server error' });
    }
};


module.exports = { uploadAndImport, home, delete: deleteDocument };
