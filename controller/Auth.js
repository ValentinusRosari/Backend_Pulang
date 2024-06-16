const UserModel = require("../model/User");
const jwt = require('jsonwebtoken');
const bcryptjs = require('bcryptjs');

const register = async (req, res) => {
    try {
        const { username, password, passwordAgain } = req.body;

        if (password !== passwordAgain) {
            return res.status(400).json({ success: false, message: "Passwords do not match" });
        }

        const existUser = await UserModel.findOne({ username });
        if (existUser) {
            return res.status(401).json({ success: false, message: "User already exists" });
        }

        const hashedPassword = await bcryptjs.hashSync(password, 10);
        const newUser = new UserModel({
            username,
            password: hashedPassword
        });

        await newUser.save();

        res.status(200).json({ message: "User registered successfully", newUser });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
        console.log(error);
    }
}

const Login = async (req, res) => {
    try {
        const { username, password } = req.body;

        const user = await UserModel.findOne({ username });

        if (!user) {
            return res.status(404).json({ success: false, message: "Username Or Password Is Incorect" });
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(404).json({ success: false, message: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRETE);

        res.cookie('token', token, {
            httpOnly: true,
            secure: false,
            maxAge: 3600000,
        });
        res.status(200).json({ success: true, message: "Login successful", user, token });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
        console.log(error);
    }
}

const Logout = async (req, res) => {
    try {
        res.clearCookie('token');
        res.status(200).json({ message: "User logged out successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
        console.log(error);
    }
}

const CheckUser = async (req, res) => {
    try {
        const user = req.user;
        if (!user) {
            res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
        console.log(error);
    }
}

module.exports = { register, Login, Logout, CheckUser };
