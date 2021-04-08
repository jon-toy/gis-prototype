const express = require("express");
const app = express();
const superagent_request = require("superagent");
const bodyParser = require("body-parser");
const request = require("request");
const DATA_API_HOST = "https://apachecounty.org";

const redis = require("redis");
const redis_client = redis.createClient(); // this creates a new client
const NUM_BOOKS_TO_LOAD = 8;

const nodemailer = require("nodemailer");
const { google } = require("googleapis");
const OAuth2 = google.auth.OAuth2;
const nodemailerCreds = require("./nodemailer.json");

var in_dev = false;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get("/", function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/zone_select.html", function (req, res) {
  res.sendFile(__dirname + "/public/index.html");
});

app.use(express.static(__dirname + "/public"));

// Monitoring
app.get("/health", (req, res) => {
  res.status(200).send({ success: true });
});

app.get("/get-maps", function (req, res) {
  if (req.host == "localhost") in_dev = true;

  var uri = DATA_API_HOST + "/books";
  if (req.query.zone_num && req.query.zone_num != "all")
    uri += "/zone/" + req.query.zone_num;

  superagent_request.get(uri).end(function (er, in_res) {
    if (er) {
      res.json({ message: "Error: " + er });
      return console.error(er);
    }

    var res_json = {};
    res_json.host = DATA_API_HOST;
    res_json.body = in_res.body;

    // Only load a certain amount of books so we can debug faster locally
    if (in_dev == true) {
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
app.post("/rural-address/send-feedback", (req, res) => {
  // Get the fields for the email
  var name = req.body["name"];
  var email = req.body["email"];
  var feedback = req.body["feedback"];

  var apn = req.body["parcel[apn]"];
  var owner = req.body["parcel[owner]"];
  var remarks = req.body["parcel[remarks]"];
  var road = req.body["parcel[road]"];
  var situs = req.body["parcel[situs]"];

  if (name === null || email === null || feedback === null) {
    return res.json({
      success: false,
      message: "Missing name, email, or feedback",
    });
  } else {
    // Send the email

    const oauth2Client = new OAuth2(
      nodemailerCreds.clientId,
      nodemailerCreds.clientSecret, // Client Secret
      "https://developers.google.com/oauthplayground" // Redirect URL
    );

    oauth2Client.setCredentials({
      refresh_token: "Your Refresh Token Here",
    });
    const accessToken = oauth2Client.getAccessToken();

    var transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: "apachecountyfeedback@gmail.com",
        clientId: nodemailerCreds.clientId,
        clientSecret: nodemailerCreds.clientSecret,
        refreshToken: nodemailerCreds.refreshToken,
        accessToken: accessToken,
      },
    });

    // Assemble Text
    var emailHtml =
      "Hello,<br>" +
      'The <a href="https://jt.co.apache.az.us/rural_address.html">Apache County Rural Address App</a> ' +
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
      to:
        "robert.toy@cox.net, jonathon.toy@gmail.com, tdavis@co.apache.az.us, zpemberton@co.apache.az.us",
      subject: "Rural Address Feedback",
      html: emailHtml,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log(error);
      } else {
        console.log("Email sent: " + info.response);
      }
    });
    return res.json({ success: true, name: name });
  }
});

app.post("/rural-address/fire-truck-dispatch", (req, res) => {
  var apn = req.body["apn"];
  var zone = req.body["zone"];
  var subject = req.body["subject"];
  if (subject === null) subject = "";
  var recipients = req.body["recipients[]"];

  if (recipients === null || apn === null || zone === null) {
    return res.json({ success: false, message: "Missing apn or recipients" });
  } else {
    // Get the possible fire contacts
    request.get(
      "https://apachecountyfirecontact.firebaseio.com/fire/contacts.json",
      (err, response, body) => {
        const contacts = JSON.parse(response.body);
        // Send the email

        const oauth2Client = new OAuth2(
          nodemailerCreds.clientId,
          nodemailerCreds.clientSecret, // Client Secret
          "https://developers.google.com/oauthplayground" // Redirect URL
        );

        oauth2Client.setCredentials({
          refresh_token: "Your Refresh Token Here",
        });
        const accessToken = oauth2Client.getAccessToken();

        var transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            type: "OAuth2",
            user: "apachecountyfeedback@gmail.com",
            clientId: nodemailerCreds.clientId,
            clientSecret: nodemailerCreds.clientSecret,
            refreshToken: nodemailerCreds.refreshToken,
            accessToken: accessToken,
          },
        });

        var link =
          "https://jt.co.apache.az.us/fire_truck.html?parcel=" +
          apn +
          "&zone=" +
          zone;

        // Assemble recipients
        var emailRecipients = "";

        if (Array.isArray(recipients)) {
          for (var i = 0; i < recipients.length; i++) {
            var id = parseInt(recipients[i]);
            if (isNaN(id) || id < 0) continue;

            emailRecipients += getFromContacts(id, contacts);
            if (i < recipients.length - 1) emailRecipients += ",";
          }
        }

        function getFromContacts(id, contacts) {
          const contact = contacts.find((contact) => contact.id === id);

          if (contact.type == "EMAIL") {
            return contact.value;
          } else if (contact.type == "PHONE") {
            return contact.value + "@vtext.com";
          }

          return "";
        }

        // Assemble Text
        var emailHtml =
          "Hello,<br>" +
          "The Apache County Rural Address App " +
          "has sent you a Fire Truck Link: <br><br>" +
          subject +
          "<br><br>" +
          '<a href="' +
          link +
          '">Fire Truck Link</a><br>' +
          '<a href="' +
          link +
          '">' +
          link +
          "</a><br>";

        if (emailRecipients.indexOf("@vtext.com") > 0) emailHtml = link; // Add the link in non-HTML format for phones

        var mailOptions = {
          from: "apachecountyfeedback@gmail.com",
          to: emailRecipients,
          subject: "Dispatch Link - " + subject,
          html: emailHtml,
        };

        transporter.sendMail(mailOptions, function (error, info) {
          if (error) {
            console.log(error);
          } else {
            console.log("Email sent: " + info.response);
          }
        });
        return res.json({ success: true });
      }
    );
  }
});

app.post("/submit-feedback", function (req, res) {
  // g-recaptcha-response is the key that browser will generate upon form submit.
  // if its blank or null means user has not selected the captcha, so return the error.
  if (
    req.body["g-recaptcha-response"] === undefined ||
    req.body["g-recaptcha-response"] === "" ||
    req.body["g-recaptcha-response"] === null
  ) {
    return res.json({
      responseCode: 1,
      success: false,
      message: "Please fill out the recaptcha.",
    });
  }

  // Put your secret key here.
  var secretKey = "6LcwGlUUAAAAALaWvtghdGIenEI2w8xMV9CFiBBC";

  // req.connection.remoteAddress will provide IP address of connected user.
  var verificationUrl =
    "https://www.google.com/recaptcha/api/siteverify?secret=" +
    secretKey +
    "&response=" +
    req.body["g-recaptcha-response"] +
    "&remoteip=" +
    req.connection.remoteAddress;

  // Hitting GET request to the URL, Google will respond with success or error scenario.
  request(verificationUrl, function (error, response, body) {
    body = JSON.parse(body);
    // Success will be true or false depending upon captcha validation.
    if (body.success !== undefined && !body.success) {
      return res.json({
        success: false,
        message: "Failed captcha verification",
      });
    }

    // Get the fields for the email
    var name = req.body["feedback-name"];
    var email = req.body["feedback-email"];
    var feedback = req.body["feedback-feedback"];

    if (name === null || email === null || feedback === null) {
      return res.json({
        success: false,
        message: "Missing name, email, or feedback",
      });
    } else {
      // Send the email
      var transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          type: "OAuth2",
          clientId: nodemailerCreds.clientId,
          clientSecret: nodemailerCreds.clientSecret,
          refreshToken: nodemailerCreds.refreshToken,
          accessToken: accessToken,
        },
      });

      var mailOptions = {
        from: email,
        to: "apachecountyfeedback@gmail.com",
        subject: "GIS Feedback",
        text: "Feedback from " + name + ", " + email + ": " + feedback,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent: " + info.response);
        }
      });
      return res.json({ success: true, name: name });
    }
  });
});

app.listen(3000, function () {
  console.log("Test app listening on port 3000!");
});
