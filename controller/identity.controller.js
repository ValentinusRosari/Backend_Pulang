const Identity = require("../model/Identity");

const createIdentity = async (req, res) => {
  try {
    const identity = new Identity({ ...req.body });

    await identity.save();

    res.status(201).json({ succes: true, data: identity });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const readIdentity = async (req, res) => {
  try {
    const identity = await Identity.find();

    res.status(200).json({ succes: true, data: identity });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const updateIdentity = async (req, res) => {
  try {
    const identityId = req.params.id;
    const updatedData = { ...req.body };

    const identity = await Identity.findOneAndUpdate(
      { _id: identityId },
      updatedData,
      {
        new: true,
      }
    );

    if (!identity) {
      return res.status(404).json({ message: "Identity record not found" });
    }

    res.status(200).json({ succes: true, data: identity });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

const deleteIdentity = async (req, res) => {
  try {
    const identityId = req.params.id;

    const identity = await Identity.findOneAndDelete({ _id: identityId });

    res.status(200).json({ success: true, data: "Identity removed!" });
  } catch (error) {
    res.status(500).send(error.message);
  }
};

module.exports = {
  createIdentity,
  readIdentity,
  updateIdentity,
  deleteIdentity,
};