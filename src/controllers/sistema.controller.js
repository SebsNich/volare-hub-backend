const prisma = require('../lib/prisma');

const keepalive = async (req, res) => {
    try {
        await prisma.user.count();
        res.status(200).json({ status: 'ok', timestamp: new Date() });
    }
    catch (error) {
        res.status(500).json({ status: 'error' });
    }
}

module.exports = {
    keepalive
}
