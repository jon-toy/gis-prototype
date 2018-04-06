const express = require('express');
const app = express();

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
})

app.listen(80, function () {
  console.log('Test app listening on port 80!');
})