var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

// io.on('connection', (socket) => {
//     console.log('a user connected');
//     socket.emit('welcome', "You are connected to the server");
// });

let multiplayer = io.of('/multiplayer');


multiplayer.on("connection", (socket) => {
    socket.emit('welcome', "You are in multiplayer room")

    socket.on('joinRoom', (userData) => {
        // socket.emit('success', "You have connected successully to room ", userData.room);
        socket.join(userData.room);
        socket.emit('userjoined', "New user has joined the chat : " + userData.name)
        io.of('/multiplayer').to(userData.room).emit('newmsg', "You have a new msg " + userData.msg);
    })

    // socket.on('broadcast', (data) => {
    //     io.of('/multiplayer').to(data.room).emit('newmsg', "You have a new msg " + data.msg);
    // })

})

http.listen(3000, () => {
    console.log('listening on *:3000');
});