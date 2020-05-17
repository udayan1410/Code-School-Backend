var express = require('express');
var app = express();
var requestHandler = require('./requestHandler');
var utils = require('./utils');
var bodyParser = require('body-parser');

const numOfQuestions = 10;
var multiplayerQueue = {
    "android": [],
    "java": []
};

var playerWaitingQueue = [];

//Body parser to parse json data
app.use(bodyParser.json())

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
        SinglePlayerStreak: 0,
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


//Multiplayer quiz find
//Sending course and id
//Input : { course:"android", id:"12392183"}
//Output : { status:"Success", sessionId: "123123954845" }
app.post('/multiplayer/find', (req, res) => {

    let userData = { ...req.body }
    let course = userData.course;

    //Pushing object of the current response into the array so that we can send data back
    multiplayerQueue[course].push({
        ...userData,
        responseObject: res
    })

    //Checking if players are enough
    if (multiplayerQueue[course].length >= 2) {
        let player1 = multiplayerQueue[course].pop();
        let player2 = multiplayerQueue[course].pop();

        //Randomly Selecting total questions out of the pool
        utils.getRandomQuestions(numOfQuestions, course, (questionsArray) => {

            //Setting a new and unique session id
            const sessionId = player1.id + player2.id;
            let player1Id = player1.id;
            let player2Id = player2.id;

            let newURL = `/multiplayer/session/${sessionId}`;
            let session = {
                sessionId: sessionId,
                course: course,
                playerData: {},
                questionIndex: 0,
                totalQuestions: numOfQuestions,
                questions: questionsArray
            }
            //Setting player data for player1
            session.playerData[player1Id] = {
                answeredQuestion: false,
                score: 0,
            }
            //Setting player data for player2
            session.playerData[player2Id] = {
                answeredQuestion: false,
                score: 0,
            }
            //Sending back the session id to the end user
            requestHandler.put(newURL, session, (resp) => {
                //Sending status and session id
                player1.responseObject.send({
                    status: resp,
                    sessionId: sessionId,
                })

                //Sending status and session id
                player2.responseObject.send({
                    status: resp,
                    sessionId: sessionId,
                })
            });
        });
    }
})

//Canceling to find the match
//Input : { course:"android", id:"12392183"}
//Output : { status:"Success", sessionId: "123123954845" }
app.post('/multiplayer/cancelfind', (req, res) => {
    let userData = { ...req.body }
    let course = userData.course;

    multiplayerQueue[course] = multiplayerQueue[course].filter(element => element.id != userData.id)

    res.send({ status: "Match not found" })
})


//Player will send session id
//Route Params : sessionId
//Output : {question : Array, playerData : jsonObject}
app.get(`/multiplayer/session/:sessionId`, (req, res) => {
    requestHandler.get(`/multiplayer/session/${req.params.sessionId}`, sessionData => {



        const questions = {
            ...sessionData.questions[sessionData.questionIndex]
        }

        let playerStatus = [];

        for (let playerData in sessionData.playerData) {
            playerStatus.push(
                {
                    playerId: playerData,
                    playerScore: sessionData.playerData[playerData].score,
                })
        }

        let quizQuestionsAndData = {
            question: questions.question,
            options: questions.options,
            answer: questions.answer,
            playerStatus: playerStatus,
        }


        res.send(quizQuestionsAndData);
    })
})


//Player will send player's answer and players id with session id as route params.
//Route params : sessionId
//Input : { id:"1312312", answer:"asdasda" }
//Output : { status:"Success", endOfQuiz : true } | { status:"Success", endOfQuiz : false }
app.post(`/multiplayer/session/:sessionId`, (req, res) => {

    requestHandler.get(`/multiplayer/session/${req.params.sessionId}`, sessionData => {
        let playerId = req.body.id;
        let answer = req.body.answer;
        let sessionId = req.params.sessionId;

        //Making the answer true for player who has answered the question
        sessionData.playerData[playerId].answeredQuestion = true;

        //Checking if answer is correct else correcting it
        if (sessionData.questions[sessionData.questionIndex].answer === answer)
            sessionData.playerData[playerId].score += 1

        let allAnswered = true
        for (let pData in sessionData.playerData)
            // console.log(sessionData.playerData[pData]);
            if (sessionData.playerData[pData].answeredQuestion === false)
                allAnswered = false;

        if (allAnswered) {
            //Making an empty object to use it to return response
            let playerInQueue = {}
            // console.log("All answered");
            //Removing the element from queue where the player is waiting
            playerWaitingQueue = playerWaitingQueue.filter(playerWaiting => {
                if (playerWaiting.sessionId === sessionId) {
                    playerInQueue = playerWaiting;
                    return false;
                }
                return true;
            })

            // console.log("Sending back response ");
            //Updating the true values to false                                     
            sessionData.playerData[playerInQueue.id].answeredQuestion = false;
            sessionData.playerData[playerId].answeredQuestion = false;
            //Update the question index
            sessionData.questionIndex += 1;

            //Return object for quiz status
            let quizStatus = {
                status: "Success",
                endOfQuiz: false,
            }
            //Quiz is over send that data to end user in object so delete quiz session object and update multiplayer streak
            if (sessionData.questionIndex === sessionData.questions.length)
                quizStatus.endOfQuiz = true;

            //Sending response to previous player and current player that answers noted 
            playerInQueue.responseObject.send(quizStatus);
            res.send(quizStatus);
        }
        //All people have not answered so adding the current player in playerWaitingQueue
        else {
            playerWaitingQueue.push({
                sessionId: sessionId,
                responseObject: res,
                id: playerId,
            })
        }
        //Updating the Database 
        requestHandler.put(`/multiplayer/session/${req.params.sessionId}`, sessionData, (status) => console.log("Posted Update"))
    })
});

//Route Params : Session id 
//Output : {status:"Success",winnerId:"2130218"}
app.get(`/multiplayer/session/quiz-over/:sessionId`, (req, res) => {
    let sessionId = req.params.sessionId;


    requestHandler.get(`/multiplayer/session/${sessionId}`, (sessionData) => {
        try {
            let maxScore = 0;
            let winnerId = null;

            if (sessionData === null)
                throw new Error("Session Cleared");

            const playerData = { ...sessionData.playerData }

            //For loop to get the winner and winner id
            for (let element in playerData) {
                if (playerData[element].score > maxScore) {
                    winnerId = element;
                    maxScore = playerData[element].score;
                }
            }

            const reply = { status: "Match Over", winnerId: winnerId }

            if (winnerId == null)
                res.send(reply)

            else {
                //Getting user data for the winner id
                requestHandler.get(`/users/${winnerId}`, (userData) => {
                    userData.MultiPlayerStreak += 1;
                    //Putting the updated score
                    requestHandler.put(`/users/${winnerId}`, userData, (resp) => {

                        res.send(reply)
                    })
                })
            }
        }
        catch (error) {
            res.send({ status: error.message })
        }
    })

})

app.listen(8000, "10.0.0.217");