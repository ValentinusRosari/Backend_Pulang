const Event = require("../model/Event");
const { mergeInHouseAndExtractFiles } = require("./vhp.controller");
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

const createEvent = async (req, res) => {
  try {
    const event = new Event({ ...req.body });

    await event.save();
    await mergeInHouseAndExtractFiles();
    await delAsync('events');

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEvent = async (req, res) => {
  const cacheKey = 'events';

  try {
    const cachedData = await getAsync(cacheKey);
    if (cachedData) {
      console.log('Data found in cache');
      return res.status(200).json({ success: true, data: JSON.parse(cachedData) });
    }

    const events = await Event.find()
      .populate("guestId")
      .populate("roomId")
      .populate("employeeId")
      .populate("requestId")
      .populate("feedbackId");

    await setAsync(cacheKey, JSON.stringify(events), 'EX', 3600);

    res.status(200).json({ success: true, data: events });
  } catch (error) {
    res.status(500).send(error.message);
    console.error(error);
  }
};

const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const updatedData = { ...req.body };

    const event = await Event.findOneAndUpdate({ _id: eventId }, updatedData, { new: true });

    if (!event) {
      return res.status(404).json({ message: "Event record not found" });
    }

    await mergeInHouseAndExtractFiles();
    await delAsync('events');

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteEvent = async (req, res) => {
  try {
    const eventId = req.params.id;

    const event = await Event.findOneAndDelete({ _id: eventId });

    if (!event) {
      return res.status(404).json({ message: "Event record not found" });
    }

    await mergeInHouseAndExtractFiles();
    await delAsync('events');

    res.status(200).json({ success: true, data: "Event removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createEvent,
  readEvent,
  updateEvent,
  deleteEvent,
};
