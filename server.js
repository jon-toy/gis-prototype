const express = require('express');
const app = express();
const superagent_request = require("superagent");
const bodyParser = require('body-parser');
const request = require('request');
const DATA_API_HOST = 'https://apachecounty.org';
const nodemailer = require('nodemailer');
const redis = require('redis');
const redis_client = redis.createClient(); // this creates a new client
const NUM_BOOKS_TO_LOAD = 8;

var in_dev = false;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : false}));

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
})

app.get('/zone_select.html', function (req, res) {
  res.sendFile(__dirname + '/public/index.html');
})

app.use(express.static(__dirname + '/public'));

app.get('/get-maps', function(req, res) {
	if ( req.host == 'localhost' ) in_dev = true;

	var uri = DATA_API_HOST + '/books';
	if ( req.query.zone_num && req.query.zone_num != 'all' ) uri += "/zone/" + req.query.zone_num;

	superagent_request
		.get(uri)
		.end(function (er, in_res) {
			if (er) 
			{
				res.json({"message": "Error: " + er});
				return console.error(er)
			}
			
			var res_json = {};
			res_json.host = DATA_API_HOST;
			res_json.body = in_res.body;

			// Only load a certain amount of books so we can debug faster locally
			if ( in_dev == true )
			{
				//res_json.body.files.splice(0, res_json.body.files.length - 4 - NUM_BOOKS_TO_LOAD);
				/*res_json.body.files = []; 
				res_json.body.files.push('101.json'); 
				res_json.body.files.push('102.json');
				res_json.body.files.push('103.json');
				res_json.body.files.push('104.json');
				res_json.body.files.push('105.json');
				res_json.body.files.push('107.json');
				res_json.body.files.push('108.json');*/
			}

			res.json(res_json);
			
			}); 
});

// TODO: Update this to read fields from request body and properly format the email
app.post('/rural-address/send-feedback', (req, res) => {
	// Get the fields for the email
	var name = req.body['name'];
	var email = req.body['email'];
	var feedback = req.body['feedback'];

	var apn = req.body['parcel[apn]'];
	var owner = req.body['parcel[owner]'];
	var remarks = req.body['parcel[remarks]'];
	var road = req.body['parcel[road]'];
	var situs = req.body['parcel[situs]'];

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
				pass: 'eggdrop1315'
			}
		});

		// Assemble Text
		var emailHtml = 
		"Hello,<br>" +
		"The <a href=\"https://jt.co.apache.az.us/rural_address.html\">Apache County Rural Address App</a> " + 
		"has received feedback for the following parcel: <br><br>";

		if (apn) emailHtml += "<b>APN</b>: " + apn + "<br>";
		if (owner) emailHtml += "<b>Owner</b>: " + owner + "<br>";
		if (remarks) emailHtml += "<b>Remarks</b>: " + remarks + "<br>";
		if (road) emailHtml += "<b>Road</b>: " + road + "<br>";
		if (situs) emailHtml += "<b>Situs</b>: " + situs + "<br>";

		emailHtml += "<br><br>";

		emailHtml += "<b>From</b>: " + name + " (" + email + ")<br><br>";
		emailHtml += feedback;
		
		var mailOptions = {
			from: email,
			to: 'robert.toy@cox.net, jonathon.toy@gmail.com, tdavis@co.apache.az.us, zpemberton@co.apache.az.us',
			subject: 'Rural Address Feedback',
			html: emailHtml
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

app.post('/rural-address/fire-truck-dispatch', (req, res) => {
	var apn = req.body['apn'];
	var recipients = req.body['recipients[]'];

	if ( recipients === null || apn === null ) 
	{
		return res.json({"success" : false, "message": "Missing apn or recipients"});
	}
	else
	{
		// Send the email
		var transporter = nodemailer.createTransport({
			service: 'gmail',
			auth: {
				user: 'apachecountyfeedback@gmail.com',
				pass: 'eggdrop1315'
			}
		});

		var link = "https://jt.co.apache.az.us/fire_truck.html?parcel=" + apn;

		// Assemble Text
		var emailHtml = 
		"Hello,<br>" +
		"The Apache County Rural Address App " + 
		"has sent you a Fire Truck Link: <br><br>" +
		"<a href=\"" + link + "\">Fire Truck Link</a><br>" +
		"<a href=\"" + link + "\">" + link + "</a><br>";

		// Assemble recipients
		var emailRecipients = '';

		if (Array.isArray(recipients)) {
			for (var i = 0; i < recipients.length; i++) {
				if (recipients[i] === 'dispatch') emailRecipients += 'coffelt@co.apache.az.us, ';
				else if (recipients[i] === 'alpine') emailRecipients += 'z.vanslyke.alpine@frontier.com, ';
				else if (recipients[i] === 'eagar') emailRecipients += 'fadams@eagaraz.gov, ';
				else if (recipients[i] === 'vernon') emailRecipients += 'chief@vfd.org, ';
				else if (recipients[i] === 'dev') emailRecipients += 'jonathon.toy@gmail.com, robert.toy@cox.net, ';
			}
		}
		else {
				if (recipients === 'dispatch') emailRecipients += 'coffelt@co.apache.az.us, ';
				else if (recipients === 'alpine') emailRecipients += 'z.vanslyke.alpine@frontier.com, ';
				else if (recipients === 'eagar') emailRecipients += 'fadams@eagaraz.gov, ';
				else if (recipients === 'vernon') emailRecipients += 'chief@vfd.org, ';
				else if (recipients === 'dev') emailRecipients += 'jonathon.toy@gmail.com, robert.toy@cox.net, ';
		}
		
		
		var mailOptions = {
			from: 'apachecountyfeedback@gmail.com',
			to: emailRecipients,
			subject: 'Fire Truck Dispatch Link',
			html: emailHtml
		};
		
		transporter.sendMail(mailOptions, function(error, info){
			if (error) {
				console.log(error);
			} else {
				console.log('Email sent: ' + info.response);
			}
		});
		return res.json({"success" : true});
	}
});

app.post('/submit-feedback',function(req,res) {
  // g-recaptcha-response is the key that browser will generate upon form submit.
  // if its blank or null means user has not selected the captcha, so return the error.
  if(req.body['g-recaptcha-response'] === undefined || req.body['g-recaptcha-response'] === '' || req.body['g-recaptcha-response'] === null) {
    return res.json({"responseCode" : 1, "success" : false, "message" : "Please fill out the recaptcha."});
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
					pass: 'apache45291'
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