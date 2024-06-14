const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['admin', 'user'],
        default: 'user'
    },
    password: {
        type: String,
        required: true
    }
}, { timestamps: true });

const UserModel = mongoose.model('users', userSchema);

module.exports = UserModel;
