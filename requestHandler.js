var axios = require('axios');
var baseURL = 'https://codeschooltest-b94f9.firebaseio.com'


var handleGetRequest = (url, callBackFunc) => {

    let finalUrl = baseURL + url + ".json";
    axios.get(finalUrl)
        .then(res => {
            callBackFunc(res.data);
        })
        .catch(err => console.log("Failed to Get"))
}

var handlePostRequest = (url, data, callBackFunc) => {
    let finalUrl = baseURL + url + '.json';
    axios.post(finalUrl, data)
        .then(res => callBackFunc("Success"))
        .catch(err => console.log("Failed to Post"))
}

var handlePutRequest = (url, data, callBackFunc) => {
    let finalUrl = baseURL + url + '.json';
    axios.put(finalUrl, data)
        .then(res => callBackFunc("Success"))
        .catch(err => console.log("Failed to Put"))
}


var handleDeleteRequest = (url, data, callBackFunc) => {
    let finalUrl = baseURL + url + '.json';
    axios.delete(finalUrl, data)
        .then(res => callBackFunc("Success"))
        .catch(err => console.log("Failed to Delete"))
}


module.exports = {
    get: handleGetRequest,
    post: handlePostRequest,
    put: handlePutRequest,
    delete: handleDeleteRequest
}

