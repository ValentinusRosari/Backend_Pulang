const express = require('express');
const { CheckUser, Login, Logout, register } = require('../controller/Auth');
const { IsUser } = require('../middleware/verifyToken');

const router = express.Router();

router.post('/register', register);
router.post('/login', Login);
router.post('/logout', Logout);
router.get('/CheckUser', IsUser, CheckUser);

module.exports = router;
