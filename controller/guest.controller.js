const Guest = require("../model/Guest");

const createGuest = async (req, res) => {
  try {
    const guest = new Guest({ ...req.body });

    await guest.save();

    res.status(201).json({ succes: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readGuest = async (req, res) => {
  try {
    const guest = await Guest.find();

    res.status(200).json({ succes: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateGuest = async (req, res) => {
  try {
    const guestId = req.params.id;
    const updatedData = { ...req.body };

    const guest = await Guest.findOneAndUpdate({ _id: guestId }, updatedData, {
      new: true,
    });

    if (!guest) {
      return res.status(404).json({ message: "Guest record not found" });
    }

    res.status(200).json({ succes: true, data: guest });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteGuest = async (req, res) => {
  try {
    const guestId = req.params.id;

    const guest = await Guest.findOneAndDelete({ _id: guestId });

    res.status(200).json({ success: true, data: "Guest removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createGuest,
  readGuest,
  updateGuest,
  deleteGuest,
};
