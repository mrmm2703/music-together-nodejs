"use strict";

// Import needed modules
var fs = require("fs");

var https = require("https");

var mysql = require("mysql");

var DatabasePool = require("./db"); // Create a DatabasePool object


var db = new DatabasePool();
var banned_words = db.getBannedWords(); // Create a HTTPS server

var server = https.createServer({
  key: fs.readFileSync("/home/azureuser/private.key"),
  cert: fs.readFileSync("/home/azureuser/certificate.crt")
}); // Initialise socket.io with CORS allowed

var io = require("socket.io")(server, {
  cors: {
    origin: "https://morahman.me",
    methods: ["GET", "POST"]
  }
});

server.listen(3000); // var groups = {
//     "4729": {
//         "users": {
//             "user1": {
//                 "prof_pic": "profPic.png",
//                 "name": "Muhammad"
//             },
//             "user2": {
//                 "prof_pic": "profPic.png",
//                 "name": "Momo"
//             }
//         },
//         "likes": {
//             "track1_id": 7,
//             "track2_id": 4
//         }
//     }
// }

var groups = {}; // When a new connection is established

io.on("connection", function (socket) {
  console.log("New connection.");
  console.log(banned_words); // When user joins for the first time

  socket.on("joinedGroup", function (data) {
    socket.spotifyId = data.id;
    socket.group = data.group;
    socket.join(data.group); // Check if group exists

    if (!groups.hasOwnProperty(socket.group)) {
      groups[socket.group] = {
        users: {},
        likes: {}
      };
    } // Add user to groups object


    groups[socket.group]["users"][socket.spotifyId] = {
      "prof_pic": data.prof_pic,
      "name": data.name
    }; // Send back a response to new user

    io.to(socket.id).emit("usersInGroup", groups[socket.group]); // Tell all other users new user is here

    socket.to(socket.group).emit("newUser", {
      id: socket.spotifyId,
      prof_pic: groups[socket.group]["users"][socket.spotifyId]["prof_pic"],
      name: groups[socket.group]["users"][socket.spotifyId]["name"]
    }); // Add an ENTER group log

    db.insertGroupLog(socket.spotifyId, socket.group, "ENTER"); // Update users table with group ID

    db.updateUserGroupId(socket.spotifyId, socket.group);
    console.log(groups);
  }); // When user leaves a group session

  socket.on("disconnect", function () {
    // Add an EXIT group log
    db.insertGroupLog(socket.spotifyId, socket.group, "EXIT"); // Tell other users that the user has disconnected

    io.to(socket.group).emit("userLeft", socket.spotifyId); // Remove the user from the groups object

    delete groups[socket.group]["users"][socket.spotifyId]; // Remove group if empty

    if (Object.keys(groups[socket.group]["users"]).length == 0) {
      delete groups[socket.group];
    } // Update users table with group ID


    db.updateUserGroupId(socket.spotifyId, null);
    console.log(groups);
  }); // When a message is received

  socket.on("message", function (data) {
    // Check if message contains banned word
    var banned = false;
    var word;

    for (var i = 0; i < banned_words.length; i++) {
      if (data.includes(banned_words[i])) {
        banned = true;
        word = banned_words[i];
        break;
      }
    }

    if (banned) {
      // Tell client message was banned
      io.to(socket.id).emit("messageBanned", word); // Log banned word usage and message in database

      db.logBannedWord(word, socket.spotifyId, socket.group, data);
    } else {
      // Log the message in database
      db.logMessage(data, socket.spotifyId, socket.group); // Send to all clients new message

      io.to(socket.group).emit("newMessage", {
        id: socket.spotifyId,
        message: data
      });
    }
  }); // When a user is typing

  socket.on("typing", function () {
    io.to(socket.group).emit("typing", socket.spotifyId);
  });
});