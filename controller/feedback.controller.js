const Feedback = require("../model/Feedback");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createFeedback = async (req, res) => {
  try {
    const feedback = new Feedback({ ...req.body });

    await feedback.save();
    await delAsync('feedbacks');

    res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readFeedback = async (req, res) => {
  const cacheKey = 'feedbacks';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const feedback = await Feedback.find();

    await setAsync(cacheKey, JSON.stringify(feedback), 'EX', 3600);

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
    console.error(error);
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

    await delAsync('feedbacks');

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteFeedback = async (req, res) => {
  try {
    const feedbackId = req.params.id;

    const feedback = await Feedback.findOneAndDelete({ _id: feedbackId });

    if (!feedback) {
      return res.status(404).json({ message: "Feedback record not found" });
    }

    await delAsync('feedbacks');

    res.status(200).json({ success: true, data: "Feedback removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createFeedback,
  readFeedback,
  updateFeedback,
  deleteFeedback,
};
