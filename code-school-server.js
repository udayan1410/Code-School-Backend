var express = require('express');
var socket = require('socket.io');
var utils = require('./utils');
var requestHandler = require('./requestHandler');
var bodyParser = require('body-parser');
const totalNumQuestions = 5;

//App setup
var app = express();
app.use(bodyParser.json());

var matchFindQueue = {
    "java": [],
    "android": [],
}

var QuizRoomsData = {}


//Get and Post Requests handler

//Helper function
var getAllUsers = (callBackFunc) => requestHandler.get(`/users`, resp => callBackFunc(resp))


//Sign up For user
//End user will send me username, password, email
//Input : { username , password, email }
//Output : { status:"Fail", id : null } / { status : "Success", id:id }
app.post('/signup', (req, res) => {

    //Creating unique id for each user
    let id = new Date().valueOf();
    let userData = {
        ...req.body,
        id: id,
        CurrentStreak: 0,
        MultiPlayerStreak: 0,
    }
    //Checking if user exists
    getAllUsers((resp) => {
        let duplicate = false;
        for (let element in resp) {
            if (userData.email === resp[element].email) {
                duplicate = true;
                break
            }
        }


        //If Duplicate User send fail status else send true status
        duplicate ? res.send({ status: "Fail : Email Exists", id: null }) : requestHandler.put(`/users/${id}`, userData, (resp) => res.send({ status: resp, id: id }));
    })
})


//Login functionality
//End user will send email and password
//Input : { email : "asdas@gmail.com", password : ""}
//Output : Success=>{ status : "Success", userData : data } Fail=> { status: "Fail", userData:null }
app.post('/login', (req, res) => {


    let userEmail = req.body.email;
    let userPassword = req.body.password;

    //Sending back response data i.e. user info    
    getAllUsers(resp => {
        let userFound = false;
        let userData = null;
        for (let element in resp) {
            if (userEmail === resp[element].email && userPassword === resp[element].password) {
                const user = resp[element];
                userData = { ...user }
                userFound = true;
                break
            }
        }

        //If user found then send success else send fail
        userFound ? res.send({ status: "Success", userData: userData }) : res.send({ status: "Incorrect email or password", userData: null });
    })
})


//process.env.PORT
var server = app.listen(process.env.PORT, () => console.log("Listening on port 3000"));

//socket setup
var io = socket(server);

//Web Socket Programming for RealTime data transmission
io.of('/multiplayer/find').on('connection', (socket) => {

    //Helper Function
    //Input is roomid and output is question,roomid,playerData and gameOver info
    let sendQuestion = (roomID) => {

        //Get the current question index and send that question to the room
        const questionIndex = QuizRoomsData[roomID].questionIndex;
        let Question = QuizRoomsData[roomID].questions[questionIndex];

        let quizStatus = {
            question: Question,
            roomid: roomID,
            playerData: QuizRoomsData[roomID].playerData,
            gameOver: false,
        }


        if (questionIndex < totalNumQuestions)
            io.of('/multiplayer/find').to(roomID).emit('GetQuestionEvent', quizStatus);

        else {
            console.log("Game over for " + roomID);
            quizStatus.gameOver = true;
            io.of('/multiplayer/find').to(roomID).emit('GameOver', quizStatus);
        }

    }

    //On match find we need course and the user''sid
    //Input : course , id, playerName
    //Output : output of sendQuestion 
    //Logic : Initially add the player into the queue. If queue length is more than 2 
    //then pop out 2 players from the queue and match them with new session
    socket.on('findMatch', (data) => {

        let { course, id, userName } = JSON.parse(data);

        // console.log(id + " finding for: " + course);
        matchFindQueue[course].push({ id, socket, userName });

        if (matchFindQueue[course].length >= 2) {
            let player1 = matchFindQueue[course].pop();
            let player2 = matchFindQueue[course].pop();


            let roomID = player1.id + player2.id;

            console.log("Created room with id = " + roomID);

            player1.socket.join(roomID);
            player2.socket.join(roomID);

            utils.getRandomQuestions(totalNumQuestions, course, (questionsArray) => {

                QuizRoomsData[roomID] = {
                    sessionID: roomID,
                    questionIndex: 0,
                    questions: questionsArray,
                    totalQuestions: totalNumQuestions,
                    playersAnswered: [],
                    socketIds: [player1.socket.id, player2.socket.id],
                    playerData: [{ playerid: player1.id, playerScore: 0, userName: player1.userName }, { playerid: player2.id, playerScore: 0, userName: player2.userName }],
                    scoreUpdated: false,
                }

                io.of('/multiplayer/find').to(roomID).emit('findSuccess', { status: "Match Found", sessionID: roomID });

                //After players found wait 2 seconds then send question
                setTimeout(() => sendQuestion(roomID), 2000);

            })


        }
    })



    //Input will be the answer,playerid and roomid
    //Output is that of sendQuestion function
    socket.on('submitAnswer', (data) => {

        let { sessionid, id, answer } = JSON.parse(data);

        const playerid = id;
        const roomid = sessionid;

        //Get the array of players with id and their score
        let playersArray = QuizRoomsData[roomid].playerData;

        //Getting the current question index
        const index = QuizRoomsData[roomid].questionIndex;

        //Getting the answer of the question at that index
        const actualAnswer = QuizRoomsData[roomid].questions[index].answer;

        //Iterating through the total players and incrementing the score where the player id matches 
        //the id in the array        
        playersArray = playersArray.map(element => {

            if (element.playerid === playerid && actualAnswer === answer)
                element.playerScore += 1;


            return element;
        });

        //Setting this new array to 
        QuizRoomsData[roomid].playerData = playersArray;


        QuizRoomsData[roomid].playersAnswered.push(playerid);

        //Both players answered
        if (QuizRoomsData[roomid].playersAnswered.length == 2) {
            QuizRoomsData[roomid].questionIndex += 1;
            QuizRoomsData[roomid].playersAnswered.splice(0, 2);
            sendQuestion(roomid);
        }

    })


    //Users cancels finding the match as it takes too much time
    //User sends subject id and name
    socket.on('cancelFind', data => {
        let { course, id } = JSON.parse(data);
        let matchQueue = matchFindQueue[course];

        matchQueue = matchQueue.filter(element => element.id != id);

        matchFindQueue[course] = matchQueue;

        console.log("Match finding cancelled");
    })


    //Input will be room id 
    //ID is winner id
    socket.on('MatchOver', (data) => {
        let { sessionid } = JSON.parse(data);

        console.log("Match Over");


        let quizEndStatus = {
            status: "",
            winnerId: "",
            winnerScore: "",
            loserId: "",
            playerData: QuizRoomsData[sessionid].playerData
        }

        //Getting both the player's data
        let playerData = QuizRoomsData[sessionid].playerData;

        if (playerData[0].playerScore === playerData[1].playerScore) {
            quizEndStatus.status = "Tie match";
            quizEndStatus.winnerId = "Both";
        }

        else if (playerData[0].playerScore > playerData[1].playerScore) {
            quizEndStatus.status = "We have a winner";
            quizEndStatus.winnerId = playerData[0].playerid;
            quizEndStatus.winnerScore = playerData[0].playerScore;
            quizEndStatus.loserId = playerData[1].playerid;
        }

        else {
            quizEndStatus.status = "We have a winner";
            quizEndStatus.winnerId = playerData[1].playerid;
            quizEndStatus.winnerScore = playerData[1].playerScore;
            quizEndStatus.loserId = playerData[0].playerid;
        }

        QuizRoomsData[sessionid].winner = quizEndStatus.winnerId;

        // console.log("Match over sending back = ", quizEndStatus);        
        if (quizEndStatus.winnerId !== "Both") {

            if (!QuizRoomsData[sessionid].scoreUpdated) {
                QuizRoomsData[sessionid].scoreUpdated = true;
                requestHandler.get(`/users/${quizEndStatus.winnerId}`, (data) => {

                    data.CurrentStreak += 1;

                    if (data.MultiPlayerStreak < data.CurrentStreak)
                        data.MultiPlayerStreak = data.CurrentStreak;

                    requestHandler.put(`/users/${quizEndStatus.winnerId}`, data, (status) => {
                        io.of('/multiplayer/find').in(sessionid).emit('MatchOver', quizEndStatus);
                        QuizRoomsData[sessionid].scoreUpdated = false;
                    })
                })

                //Update loser streak to 0
                requestHandler.get(`/users/${quizEndStatus.loserId}`, (data) => {
                    data.CurrentStreak = 0;
                    //Push the data to server
                    requestHandler.put(`/users/${quizEndStatus.loserId}`, data, (status) => console.log("Update loser streak as  0"));
                })
            }

            else
                io.of('/multiplayer/find').to(sessionid).emit('MatchOver', quizEndStatus);
        }
        //Its a tie so send back status
        else
            io.of('/multiplayer/find').to(sessionid).emit('MatchOver', quizEndStatus);

    })

});
