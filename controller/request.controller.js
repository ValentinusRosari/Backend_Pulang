const Request = require("../model/Request");

const createRequest = async (req, res) => {
  try {
    const request = new Request({ ...req.body });

    await request.save();

    res.status(201).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readRequest = async (req, res) => {
  try {
    const request = await Request.find().populate("employeeId");

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readRequestById = async (req, res) => {
  try {
    const requestId = req.params.id;
    const request = await Request.findById(requestId);

    if (!request) {
      return res
        .status(404)
        .json({ success: false, message: "Request not found" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const updatedData = { ...req.body };

    const request = await Request.findOneAndUpdate(
      { _id: requestId },
      updatedData,
      {
        new: true,
      }
    );

    if (!request) {
      return res.status(404).json({ message: "Request record not found" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteRequest = async (req, res) => {
  try {
    const requestId = req.params.id;

    const request = await Request.findOneAndDelete({ _id: requestId });

    res.status(200).json({ success: true, data: "Request removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateReturnDate = async (req, res) => {
  try {
    const { id, returnDate } = req.body;

    const request = await Request.findOneAndUpdate(
      { _id: id },
      { returnDate },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ message: "Request record not found" });
    }

    res.status(200).json({ success: true, data: request });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createRequest,
  readRequest,
  readRequestById,
  updateRequest,
  deleteRequest,
  updateReturnDate,
};
