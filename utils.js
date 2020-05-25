var requestHandler = require('./requestHandler');

var randomNumberGenerator = (totalNumberOfQuestions, courseName, callBackFunc) => {
    let listofRandomQuestions = [];

    requestHandler.get(`/course/${courseName.toLowerCase()}/questions`, (questionsArray) => {
        while (listofRandomQuestions.length < totalNumberOfQuestions && questionsArray.length > 0) {
            let randomIndex = parseInt(Math.random() * (questionsArray.length - 1));
            listofRandomQuestions.push(...questionsArray.splice(randomIndex, 1));
        }
        callBackFunc(listofRandomQuestions);
    })

}


module.exports = {
    getRandomQuestions: randomNumberGenerator,
}