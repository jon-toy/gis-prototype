const express = require('express');
const app = express();
const superagent_request = require("superagent");
const bodyParser = require('body-parser');
const request = require('request');
const data_api_url = 'http://ec2-54-183-132-79.us-west-1.compute.amazonaws.com:3001';
const nodemailer = require('nodemailer');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
})

app.get('/get-maps', function(req, res) {
	superagent_request
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


app.use(express.static('public'));

app.listen(3000, function () {
  console.log('Test app listening on port 3000!');
})