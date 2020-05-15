const io = require('socket.io-client')

let multiplayer = io.connect("http://10.0.0.217:3000/multiplayer")

multiplayer.on("welcome", (msg) => {
    console.log("Data got", msg);
})



multiplayer.emit('joinRoom', { room: "room", msg: "Hii what issss", name: 'udayan' });

// multiplayer.emit('broadcast', { room: 'room', msg: "hello how are you" })

multiplayer.on('newmsg', (data) => console.log("Got back = " + data))

multiplayer.on('userjoined', (data) => console.log(data))

// multiplayer.on("success", (msg) => console.log("Server msg " + msg))

// multiplayer.on("msg", (msg) => console.log("MSG =  " + msg))