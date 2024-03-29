"use strict";

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance"); }

function _iterableToArrayLimit(arr, i) { if (!(Symbol.iterator in Object(arr) || Object.prototype.toString.call(arr) === "[object Arguments]")) { return; } var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

// Import needed modules
var fs = require("fs");

var https = require("https");

var mysql = require("mysql");

var DatabasePool = require("./db");

var SpotifyConnection = require("./spotify"); // Constants


var BAN_TIME = 12; // Hours to check for banned words

var BAN_WORD_LIMIT = 2; // Maximum allowed banned words in BAN_TIME (inclusive)
// Create a DatabasePool object

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

server.listen(3000);
var spotify = new SpotifyConnection();
var groups = {}; // Event listeners for the SpotifyConnection events

spotify.on("follow_playlist", function (data) {
  console.log(data);
  groups[data.groupId]["collabId"] = data.playlistId;
  io.to(data.groupId).emit("followPlaylist", data.playlistId);
});
spotify.on("playlist", function (data) {
  io.to(data.groupId).emit("updatePlaylist", data.playlistId);
}); // Get the data formatted in a pretty string

function getDate() {
  var d = new Date();
  return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear();
} // When a new connection is established


io.on("connection", function (socket) {
  console.log("New connection."); // Authorise the SpotifyConnection object with credentials

  socket.on("auth_code", function (code) {
    spotify.activateAuthCode(code).then(function (d) {
      spotify.setToken(d);
      spotify.startRefreshSequence();
    });
  }); // When admin changes banned words

  socket.on("refreshBannedWords", function () {
    banned_words = db.getBannedWords();
    console.log("Refreshing banned words...");
  }); // When user joins for the first time

  socket.on("joinedGroup", function (data) {
    socket.spotifyId = data.id;
    socket.group = data.group;
    socket.join(data.group); // Check if group exists

    if (!groups.hasOwnProperty(socket.group)) {
      groups[socket.group] = {
        users: {},
        likes: {},
        queue: [],
        host: socket.spotifyId,
        hostSocket: socket.id,
        collabId: null
      };
    } // Add user to groups object


    groups[socket.group]["users"][socket.spotifyId] = {
      "prof_pic": data.prof_pic,
      "name": data.name,
      "socket": socket.id
    }; // Send back a response to new user

    io.to(socket.id).emit("usersInGroup", groups[socket.group]); // Tell all other users new user is here

    socket.to(socket.group).emit("newUser", {
      id: socket.spotifyId,
      prof_pic: groups[socket.group]["users"][socket.spotifyId]["prof_pic"],
      name: groups[socket.group]["users"][socket.spotifyId]["name"]
    }); // Send collab playlist to new user if collab exists

    if (groups[socket.group]["collabId"] != null) {
      io.to(socket.id).emit("followPlaylist", groups[socket.group]["collabId"]);
      io.to(socket.id).emit("updatePlaylist", groups[socket.group]["collabId"]);
    } // Add an ENTER group log


    db.insertGroupLog(socket.spotifyId, socket.group, "ENTER"); // Update users table with group ID

    db.updateUserGroupId(socket.spotifyId, socket.group);
    console.log(groups);
  }); // When a weAreHere message is received from the host

  socket.on("weAreHere", function (data) {
    io.to(data.socketId).emit("weAreHere", {
      context: data.context,
      uri: data.uri,
      position: data.position,
      paused: data.paused,
      queue: groups[socket.group]["queue"],
      duration: data.duration
    });
  });
  socket.on("whereAreWe", function () {
    io.to(groups[socket.group]["hostSocket"]).emit("whereAreWe", socket.id);
  }); // When user leaves a group session

  socket.on("disconnect", function () {
    if (typeof socket.spotifyId != "undefined") {
      // Add an EXIT group log
      db.insertGroupLog(socket.spotifyId, socket.group, "EXIT"); // Tell other users that the user has disconnected

      io.to(socket.group).emit("userLeft", socket.spotifyId); // Remove the user from the groups object

      delete groups[socket.group]["users"][socket.spotifyId]; // Remove group if empty

      if (Object.keys(groups[socket.group]["users"]).length == 0) {
        delete groups[socket.group];
      } else {
        if (groups[socket.group]["host"] == socket.spotifyId) {
          // Assign a new host
          groups[socket.group]["host"] = Object.keys(groups[socket.group]["users"])[0];
          groups[socket.group]["hostSocket"] = groups[socket.group]["users"][groups[socket.group]["host"]]["socket"];
        }
      } // Update users table with group ID


      db.updateUserGroupId(socket.spotifyId, null);
      console.log(groups);
    }
  }); // When a message is received

  socket.on("message", function (data) {
    // Check if message contains banned word
    var banned = false;
    var word;

    for (var i = 0; i < banned_words.length; i++) {
      if (data.toLowerCase().includes(banned_words[i])) {
        banned = true;
        word = banned_words[i];
        break;
      }
    }

    if (banned) {
      // Tell client message was banned
      io.to(socket.id).emit("messageBanned", word); // Check if auto-ban should happen

      db.getRecentBannedWords(socket.spotifyId, BAN_TIME).then(function (count) {
        console.log("BANNED COUNT: " + count);

        if (count + 1 > BAN_WORD_LIMIT) {
          console.log("LIMIT REACHED"); // If user has reached limit of banned words, ban them

          db.banUser(socket.spotifyId);
          io.to(socket.id).emit("userBanned");
        }
      }); // Log banned word usage and message in database

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
    socket.to(socket.group).emit("typing", socket.spotifyId);
  }); // PLAYBACK STATE CONTROLS

  socket.on("pause", function () {
    socket.to(socket.group).emit("pause", socket.spotifyId);
  });
  socket.on("resume", function () {
    socket.to(socket.group).emit("resume", socket.spotifyId);
  });
  socket.on("seek", function (pos) {
    socket.to(socket.group).emit("seek", {
      id: socket.spotifyId,
      pos: pos
    });
  }); // SONG CONTROL

  socket.on("changeSong", function (songDetails) {
    if (groups[socket.group]["host"] == socket.spotifyId) {
      socket.to(socket.group).emit("changeSong", {
        uri: songDetails.uri,
        context: songDetails.context,
        paused: songDetails.paused,
        name: songDetails.name,
        id: socket.spotifyId
      });

      if (groups[socket.group]["queue"].includes(songDetails.uri)) {
        groups[socket.group]["queue"].splice(groups[socket.group]["queue"].indexOf(songDetails.uri), 1);
      }

      console.log(groups[socket.group]["queue"]);
    }
  });
  socket.on("addToQueue", function (data) {
    socket.to(socket.group).emit("addToQueue", {
      uri: data.uri,
      name: data.name,
      artist: data.artist,
      image: data.image,
      id: socket.spotifyId
    });
    groups[socket.group].queue.push(data.uri);
    console.log(groups[socket.group]["queue"]);
  });
  socket.on("makeMeHost", function () {
    groups[socket.group]["host"] = socket.spotifyId;
    groups[socket.group]["hostSocket"] = socket.id;
  }); // USER BAN

  socket.on("banUser", function (data) {
    // Check for access token
    if (data.accessToken != null) {
      // Check if access token is valid
      db.checkAccessToken(data.accessToken, function (res) {
        if (res) {
          // Find the socket ID of the user by Spotify ID
          for (var _i = 0, _Object$entries = Object.entries(groups); _i < _Object$entries.length; _i++) {
            var _Object$entries$_i = _slicedToArray(_Object$entries[_i], 2),
                key = _Object$entries$_i[0],
                value = _Object$entries$_i[1];

            for (var _i2 = 0, _Object$entries2 = Object.entries(value["users"]); _i2 < _Object$entries2.length; _i2++) {
              var _Object$entries2$_i = _slicedToArray(_Object$entries2[_i2], 2),
                  user_id = _Object$entries2$_i[0],
                  user_details = _Object$entries2$_i[1];

              if (user_id == data.id) {
                io.to(user_details["socket"]).emit("userBanned");
              }
            }
          }
        }
      });
    }
  }); // COLLABORATIVE PLAYLIST

  socket.on("addToPlaylist", function (songUri) {
    console.log("songUri:");
    console.log(songUri);

    if (groups[socket.group]["collabId"] == null) {
      spotify.addToQueue("create_playlist", {
        name: "Collab (" + socket.group + ")",
        description: "Music Together session on " + getDate() + ". Group ID: " + socket.group,
        songUri: "spotify:track:" + songUri
      }, socket.group);
    } else {
      spotify.addToQueue("add_to_playlist", {
        playlistId: groups[socket.group]["collabId"],
        songId: "spotify:track:" + songUri
      }, socket.group);
    }
  });
  socket.on("newPlaylist", function (data) {
    groups[socket.group]["collabId"] = data.collabUri; // Broadcast to rest of group the new playlist

    socket.to(socket.group).emit("followPlaylist", data.collabUri); // Tell client to add to playlist

    io.to(socket.id).emit("collabUri", {
      songId: data.songId,
      collabUri: groups[socket.group]["collabId"]
    });
  });
  socket.on("newPlaylistItem", function () {
    socket.to(socket.group).emit("updatePlaylist", groups[socket.group]["collabId"]);
  }); // SETTINGS CHANGES

  socket.on("changeName", function (newName) {
    groups[socket.group]["users"][socket.spotifyId]["name"] = newName;
    io.to(socket.group).emit("updateName", {
      id: socket.spotifyId,
      name: newName
    });
  });
  socket.on("changeProfPic", function (newProfPic) {
    groups[socket.group]["users"][socket.spotifyId]["prof_pic"] = newProfPic;
    io.to(socket.group).emit("updateProfPic", {
      id: socket.spotifyId,
      profPic: newProfPic
    });
  }); // SONG LIKING SYSTEM

  socket.on("likeSong", function (songId) {
    // Check if song exists
    if (groups[socket.group]["likes"][songId] == undefined) {
      groups[socket.group]["likes"][songId] = [];
    } // Add user to likes list for the track


    groups[socket.group]["likes"][songId].push(socket.spotifyId);
    io.to(socket.group).emit("updateLikes", {
      songId: songId,
      users: groups[socket.group]["likes"][songId]
    });
  });
  socket.on("unlikeSong", function (songId) {
    // Find index of user in array and remove
    var i = groups[socket.group]["likes"][songId].indexOf(socket.spotifyId);

    if (i > -1) {
      groups[socket.group]["likes"][songId].splice(i, 1);
    }

    io.to(socket.group).emit("updateLikes", {
      songId: songId,
      users: groups[socket.group]["likes"][songId]
    });
  });
});