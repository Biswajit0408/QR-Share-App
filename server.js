const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (let iface in interfaces) {
        for (let addr of interfaces[iface]) {
            if (addr.family === 'IPv4' && !addr.internal) return addr.address;
        }
    }
    return 'localhost';
};
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

// Setup multer for image uploads
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

let sessions = {}; // In-memory session store

app.get('/session', async (req, res) => {
    const sessionId = uuidv4();
    const ip = getLocalIP();
    const url = `http://${ip}:3000/?session=${sessionId}`;
    const qr = await QRCode.toDataURL(url);

    // Create session with timeout
    sessions[sessionId] = { created: Date.now(), expires: Date.now() + 600000 }; // 10 minutes
    setTimeout(() => delete sessions[sessionId], 600000);

    res.json({ sessionId, qr });
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
});

io.on('connection', socket => {
    let currentSession = null;

    socket.on('join-session', (sessionId) => {
        if (!sessions[sessionId]) {
            socket.emit('session-expired');
            return;
        }

        socket.join(sessionId);
        currentSession = sessionId;
        console.log(`User joined session: ${sessionId}`);
    });

    socket.on('message', (data) => {
        if (currentSession) {
            console.log(`Broadcasting in ${currentSession}:`, data);
            io.to(currentSession).emit('message', data); // sends to all in session
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});
