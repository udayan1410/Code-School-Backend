var io = require('socket.io-client');
var socket = io.connect("http://10.0.0.217:3000/multiplayer/find")

var playerData = {
    course: "android",
    id: "456",
    playerName: "Kewin"
}


let sessionid = null;

setTimeout(() => socket.emit('findMatch', playerData), 1100);

var counter = 0;

//Getting the question from the server
socket.on('GetQuestionEvent', (data) => {

    console.log("Got question " + data.question.question);

    const roomid = data.roomid;
    const playerid = playerData.id;
    const answer = data.question.answer;

    setTimeout(() => {
        let playerAnswers = {}
        playerAnswers['roomid'] = roomid;
        playerAnswers['playerid'] = playerid;
        playerAnswers['answer'] = answer;

        if (counter < 5) {
            socket.emit('submitAnswer', playerAnswers);
            counter += 1;
        }
    }, 5000)

});