const UserModel = require('../model/User');
const bcryptjs = require('bcryptjs');
const { getAsync, setAsync, delAsync } = require('../config/redisClient');

// Get all users
const Getuser = async (req, res) => {
    const cacheKey = 'allUsers';

    try {
        const cachedData = await getAsync(cacheKey);
        if (cachedData) {
            console.log('Data found in cache');
            return res.status(200).json({ users: JSON.parse(cachedData) });
        }

        const users = await UserModel.find();
        await setAsync(cacheKey, JSON.stringify(users), 3600);

        res.status(200).json({ users });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
        console.error(error);
    }
};

// Add a new user
const addUser = async (req, res) => {
    try {
        const { username, password, passwordAgain, role } = req.body;

        if (password !== passwordAgain) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const existUser = await UserModel.findOne({ username });
        if (existUser) {
            return res.status(401).json({ success: false, message: 'User already exists' });
        }

        const hashedPassword = await bcryptjs.hash(password, 10);
        const newUser = new UserModel({
            username,
            password: hashedPassword,
            role
        });

        await newUser.save();
        await delAsync('allUsers');

        res.status(200).json({ message: 'User added successfully', newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error' });
        console.log(error);
    }
};

// Update a user
const updateUser = async (req, res) => {
    try {
        const { userId, username, password, passwordAgain, role } = req.body;

        if (password !== passwordAgain) {
            return res.status(400).json({ success: false, message: 'Passwords do not match' });
        }

        const user = await UserModel.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (username) user.username = username;
        if (password) user.password = await bcryptjs.hash(password, 10);
        if (role) user.role = role;

        await user.save();
        await delAsync('allUsers');

        res.status(200).json({ message: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
        console.log(error);
    }
};

// Delete a user
const deleteUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await UserModel.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.role === 'admin') {
            return res.status(409).json({ message: 'You cannot delete an admin' });
        }

        await UserModel.findByIdAndDelete(userId);
        await delAsync('allUsers');

        res.status(200).json({ message: 'User deleted successfully', user });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
        console.log(error);
    }
};

module.exports = { Getuser, deleteUser, addUser, updateUser };
