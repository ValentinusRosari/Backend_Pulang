const Feedback = require("../model/Feedback");

const createFeedback = async (req, res) => {
  try {
    const feedback = new Feedback({ ...req.body });

    await feedback.save();

    res.status(201).json({ succes: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readFeedback = async (req, res) => {
  try {
    const feedback = await Feedback.find();

    res.status(200).json({ succes: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readFeedbackById = async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const feedback = await Feedback.findById(feedbackId);

    if (!feedback) {
      return res
        .status(404)
        .json({ success: false, message: "Feedback not found" });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateFeedback = async (req, res) => {
  try {
    const feedbackId = req.params.id;
    const updatedData = { ...req.body };

    const feedback = await Feedback.findOneAndUpdate(
      { _id: feedbackId },
      updatedData,
      {
        new: true,
      }
    );

    if (!feedback) {
      return res.status(404).json({ message: "Feedback record not found" });
    }

    res.status(200).json({ succes: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteFeedback = async (req, res) => {
  try {
    const feedbackId = req.params.id;

    const feedback = await Feedback.findOneAndDelete({ _id: feedbackId });

    res.status(200).json({ success: true, data: "Feedback removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createFeedback,
  readFeedback,
  readFeedbackById,
  updateFeedback,
  deleteFeedback,
};
