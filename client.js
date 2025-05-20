const socket = io();
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('session');

let username = '';

function renderMessage(data) {
    const div = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.textContent = data.senderName + ': ';
    nameSpan.classList.add('sender-name');
    if (data.senderName === username) {
        nameSpan.classList.add('sender');
    } else {
        nameSpan.classList.add('receiver');
    }
    div.appendChild(nameSpan);
    if (data.imageUrl) {
        const img = document.createElement('img');
        img.src = data.imageUrl;
        img.classList.add('chat-image');
        img.onclick = () => {
            const link = document.createElement('a');
            link.href = data.imageUrl;
            link.download = '';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
        div.appendChild(img);
    }
    const msgSpan = document.createElement('span');
    msgSpan.textContent = data.message || '';
    div.appendChild(msgSpan);
    document.getElementById('messages').appendChild(div);
}

if (sessionId) {
    // Guest path
    document.getElementById('qr-section').style.display = 'none';
    document.getElementById('chat-section').style.display = 'block';

    socket.emit('join-session', sessionId);

    socket.on('message', (data) => {
        console.log('Received message:', data);
        if (data.senderName !== username) {
            renderMessage(data);
        }
    });

    socket.on('session-expired', () => {
        alert("Session expired.");
    });
}

function createSession() {
    fetch('/session')
        .then(res => res.json())
        .then(data => {
            const img = document.createElement('img');
            img.src = data.qr;
            document.getElementById('qr-code').innerHTML = '';
            document.getElementById('qr-code').appendChild(img);

            // Host joins session and sees chat UI
            username = document.getElementById('username').value.trim();
            if (!username) {
                alert('Please enter your name before creating a session.');
                return;
            }
            socket.emit('join-session', data.sessionId);
            document.getElementById('chat-section').style.display = 'block';

            // Make sure host listens for messages too
            socket.on('message', (data) => {
                console.log('Host received:', data);
                if (data.senderName !== username) {
                    renderMessage(data);
                }
            });
        });
}

function sendMessage() {
    if (!username) {
        username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Please enter your name before sending messages.');
            return;
        }
    }
    const msg = document.getElementById('msg').value;
    const messageData = {
        senderName: username,
        message: msg
    };
    socket.emit('message', messageData);
    // Show outgoing message in chat box
    renderMessage(messageData);
    document.getElementById('msg').value = '';
}

function uploadImage() {
    if (!username) {
        username = document.getElementById('username').value.trim();
        if (!username) {
            alert('Please enter your name before uploading images.');
            return;
        }
    }
    const fileInput = document.getElementById('imageInput');
    if (fileInput.files.length === 0) {
        alert('Please select an image to upload.');
        return;
    }
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('image', file);

    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const messageData = {
                senderName: username,
                imageUrl: data.url,
                message: ''
            };
            socket.emit('message', messageData);
            renderMessage(messageData);
            fileInput.value = '';
        } else {
            alert('Image upload failed.');
        }
    })
    .catch(() => {
        alert('Image upload failed.');
    });
}
