const express = require('express');
const app = express();
const request = require("superagent");
const data_api_url = 'http://ec2-54-183-132-79.us-west-1.compute.amazonaws.com:3001';

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
})

app.get('/get-maps', function(req, res) {
	request
		.get(data_api_url + '/list')
		.end(function (er, in_res) {
			if (er) 
			{
				res.json({"message": "Error: " + er});
				return console.error(er)
			}
			
			var res_json = {};
			res_json.host = data_api_url;
			res_json.body = in_res.body;
			res.json(res_json);
			
			}); 
});


app.use(express.static('public'));

app.listen(3000, function () {
  console.log('Test app listening on port 3000!');
})