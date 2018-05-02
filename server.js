const express = require('express');
const app = express();
const superagent_request = require("superagent");
const bodyParser = require('body-parser');
const request = require('request');
const data_api_url = 'https://apachecounty.org';
const nodemailer = require('nodemailer');
const redis = require('redis');
const redis_client = redis.createClient(); // this creates a new client

const NUM_BOOKS_TO_LOAD = 20; // Lighten the load for dev
var in_dev = false;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
})

app.use(express.static(__dirname + '/public'));

app.get('/get-maps', function(req, res) {
	//if ( req.host == 'localhost' ) in_dev = true;
	superagent_request
		.get(data_api_url + '/books')
		.end(function (er, in_res) {
			if (er) 
			{
				res.json({"message": "Error: " + er});
				return console.error(er)
			}
			
			var res_json = {};
			res_json.host = data_api_url;
			res_json.body = in_res.body;

			// Only load a certain amount of books so we can debug faster locally
			if ( in_dev == true )
			{
				//res_json.body.files.splice(0, res_json.body.files.length - 2 - NUM_BOOKS_TO_LOAD);
				res_json.body.files = []; res_json.body.files.push('101.json');
			}

			res.json(res_json);
			
			}); 
});

app.post('/submit-feedback',function(req,res) {
  // g-recaptcha-response is the key that browser will generate upon form submit.
  // if its blank or null means user has not selected the captcha, so return the error.
  if(req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null) {
    return res.json({"responseCode" : 1,"responseDesc" : "Please select captcha"});
	}
	
  // Put your secret key here.
	var secretKey = "6LcwGlUUAAAAALaWvtghdGIenEI2w8xMV9CFiBBC";
	
  // req.connection.remoteAddress will provide IP address of connected user.
	var verificationUrl = "https://www.google.com/recaptcha/api/siteverify?secret=" + secretKey + "&response="
		+ req.body['g-recaptcha-response'] + "&remoteip=" + req.connection.remoteAddress;

  // Hitting GET request to the URL, Google will respond with success or error scenario.
  request(verificationUrl,function(error,response,body) {
		body = JSON.parse(body);
    // Success will be true or false depending upon captcha validation.
    if(body.success !== undefined && !body.success) {
      return res.json({"success" : false, "message": "Failed captcha verification"});
		}
		
		// Get the fields for the email
		var name = req.body['feedback-name'];
		var email = req.body['feedback-email'];
		var feedback = req.body['feedback-feedback'];

		if ( name === null || email === null || feedback === null ) 
		{
			return res.json({"success" : false, "message": "Missing name, email, or feedback"});
		}
		else
		{
			// Send the email
			var transporter = nodemailer.createTransport({
				service: 'gmail',
				auth: {
					user: 'apachecountyfeedback@gmail.com',
					pass: 'apache4529'
				}
			});
			
			var mailOptions = {
				from: email,
				to: 'apachecountyfeedback@gmail.com',
				subject: 'GIS Feedback',
				text: "Feedback from " + name + ", " + email + ": " + feedback
			};
			
			transporter.sendMail(mailOptions, function(error, info){
				if (error) {
					console.log(error);
				} else {
					console.log('Email sent: ' + info.response);
				}
			});
			return res.json({"success" : true, "name": name});
		}
  });
});

app.listen(3000, function () {
  console.log('Test app listening on port 3000!');
})