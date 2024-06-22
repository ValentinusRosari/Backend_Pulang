const { createClient } = require('redis');

const redisClient = createClient({
    socket: {
        host: '127.0.0.1',
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
const setAsync = (key, value, exp, time) => redisClient.set(key, value, exp, parseInt(time));
const delAsync = redisClient.del.bind(redisClient);

module.exports = {
    redisClient,
    getAsync,
    setAsync,
    delAsync
};
