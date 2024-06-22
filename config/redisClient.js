const { createClient } = require('redis');

const redisClient = createClient({
    socket: {
        host: '127.0.0.1', // Alamat IP komputer yang menjalankan Redis
        port: 6379
    }
});

redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

(async () => {
    await redisClient.connect();
})();

const getAsync = redisClient.get.bind(redisClient);
const setAsync = redisClient.set.bind(redisClient);

module.exports = {
    redisClient,
    getAsync,
    setAsync
};
