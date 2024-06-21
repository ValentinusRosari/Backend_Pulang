const Event = require("../model/Event");
const { mergeInHouseAndExtractFiles } = require("./vhp.controller");

const createEvent = async (req, res) => {
  try {
    const event = new Event({ ...req.body });

    await event.save();
    await mergeInHouseAndExtractFiles();

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readEvent = async (req, res) => {
  try {
    const event = await Event.find()
      .populate("guestId")
      .populate("roomId")
      .populate("employeeId")
      .populate("requestId")
      .populate("feedbackId");

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateEvent = async (req, res) => {
  try {
    const eventId = req.params.id;
    const updatedData = { ...req.body };

    const event = await Event.findOneAndUpdate({ _id: eventId }, updatedData, {
      new: true,
    });

    if (!event) {
      return res.status(404).json({ message: "Event record not found" });
    }

    await mergeInHouseAndExtractFiles();

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
