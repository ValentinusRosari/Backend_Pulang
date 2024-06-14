const express = require('express');
const { Getuser, deleteUser, addUser, updateUser } = require('../controller/Admin');
const { isAdmin } = require('../middleware/verifyToken');

const router = express.Router();

router.get('/getuser', isAdmin, Getuser);
router.delete('/delete/:id', isAdmin, deleteUser);
router.post('/adduser', isAdmin, addUser);
router.put('/updateuser', isAdmin, updateUser);

module.exports = router;
