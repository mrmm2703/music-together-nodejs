"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

function _possibleConstructorReturn(self, call) { if (call && (_typeof(call) === "object" || typeof call === "function")) { return call; } return _assertThisInitialized(self); }

function _assertThisInitialized(self) { if (self === void 0) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return self; }

function _getPrototypeOf(o) { _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) { return o.__proto__ || Object.getPrototypeOf(o); }; return _getPrototypeOf(o); }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function"); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, writable: true, configurable: true } }); if (superClass) _setPrototypeOf(subClass, superClass); }

function _setPrototypeOf(o, p) { _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) { o.__proto__ = p; return o; }; return _setPrototypeOf(o, p); }

var https = require("https");

var querystring = require("querystring");

var queue = require("./queue");

var EventEmitter = require("events");

var clientId = "4a8fd972e1764fb8ac898d19335a9081";
var clientSecret = "bfd33fd015ef48a4a39cd121b87f7091";
var base64auth = Buffer.from(clientId + ":" + clientSecret).toString("base64");
var scope = "playlist-modify-public playlist-modify-private";
var userId = "u051288nb9jvms048f9zqxn42";
var apiEndpoint = "api.spotify.com";
var redirectUri = "https://morahman.me/musictogether/auth/show_token.php";

var SpotifyConnection =
/*#__PURE__*/
function (_EventEmitter) {
  _inherits(SpotifyConnection, _EventEmitter);

  function SpotifyConnection() {
    var _this;

    _classCallCheck(this, SpotifyConnection);

    _this = _possibleConstructorReturn(this, _getPrototypeOf(SpotifyConnection).call(this));
    console.log("Get authorisation code from:");
    console.log("https://accounts.spotify.com/authorize?client_id=" + clientId + "&response_type=code&redirect_uri=" + redirectUri + "&scope=" + scope);
    _this.accessToken = null;
    _this.refreshToken = null;
    _this.tokenExpires = null;
    _this.operations = new queue();
    _this.running = false;
    return _this;
  }

  _createClass(SpotifyConnection, [{
    key: "activateAuthCode",
    value: function activateAuthCode(codeReq) {
      return new Promise(function (resolve, reject) {
        // POST body
        var data = querystring.stringify({
          grant_type: "authorization_code",
          code: codeReq,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret
        }); // POST options

        var authCodeOptions = {
          hostname: "accounts.spotify.com",
          path: "/api/token",
          port: 443,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(data)
          }
        };
        var req = https.request(authCodeOptions, function (res) {
          res.on("data", function (d) {
            resolve(JSON.parse(d.toString()));
          });
        });
        req.on("error", function (e) {
          reject(e);
        });
        req.end(data);
      });
    }
  }, {
    key: "setToken",
    value: function setToken(data) {
      console.log(data);
      console.log("");
      this.accessToken = data.access_token;
      this.refreshToken = typeof data.refresh_token == "undefined" ? this.refreshToken : data.refresh_token;
      this.tokenExpires = data.expires_in;
    }
  }, {
    key: "startRefreshSequence",
    value: function startRefreshSequence() {
      var _this2 = this;

      setTimeout(function () {
        console.log("Refreshing token...");

        _this2.refreshAccessToken().then(function (d) {
          _this2.setToken(d);

          console.log("New token: " + _this2.accessToken);
          console.log("New refresh token: " + _this2.refreshToken);
          console.log("Expires in: " + _this2.tokenExpires);

          _this2.startRefreshSequence();
        });
      }, (this.tokenExpires - 15) * 1000);
    }
  }, {
    key: "refreshAccessToken",
    value: function refreshAccessToken() {
      var _this3 = this;

      return new Promise(function (resolve, reject) {
        // POST data
        var data = querystring.stringify({
          grant_type: "refresh_token",
          refresh_token: _this3.refreshToken
        }); // POST options

        var options = {
          hostname: "accounts.spotify.com",
          path: "/api/token",
          port: 443,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(data),
            "Authorization": "Basic " + base64auth
          }
        };
        var req = https.request(options, function (res) {
          res.on("data", function (d) {
            resolve(JSON.parse(d.toString()));
          });
        });
        req.on("error", function (e) {
          reject(e);
        });
        req.end(data);
      });
    }
  }, {
    key: "addToQueue",
    value: function addToQueue(type, data, groupId) {
      console.log("ADDING TO QUEUE");
      this.operations.enqueue({
        type: type,
        data: data,
        groupId: groupId
      });
      console.log("IN QUEUE:");
      console.log(this.operations.peek());

      if (this.running == false) {
        console.log("NOT RUNNING. RUNNING RUNCALLER");
        this.runCaller();
      }
    }
  }, {
    key: "runCaller",
    value: function runCaller() {
      // Check if no more operations are in the queue
      if (this.operations.isEmpty()) {
        console.log("OPERATIONS IS EMPTY");
        this.running = false;
      } else {
        console.log("OPERATIONS IS NOT EMPTY. RUNNING RUNOPERATION");
        this.running = true;
        this.runOperation();
      }
    }
  }, {
    key: "runOperation",
    value: function runOperation() {
      var _this4 = this;

      var operation = this.operations.peek();
      console.log("NEW OPERATION:");
      console.log(operation);
      console.log("");

      if (operation.type == "create_playlist") {
        console.log("RUNOPERATION FOUND A CREATE PLAYLIST COMMAND");
        this.createPlaylist(operation.data.name, operation.data.description, operation.groupId, operation.data.songUri).then(function (job) {
          return _this4.createPlaylistCallback(job);
        }, function (waitTime) {
          return _this4.callerWait(waitTime);
        });
      } else if (operation.type == "add_to_playlist") {
        console.log("ADD TO PLAYLIST FOUND");
        this.addToPlaylist(operation.data.playlistId, operation.data.songId, operation.groupId).then(function (job) {
          return _this4.playlistCallback(job);
        }, function (waitTime) {
          return _this4.callerWait(waitTime);
        });
      }
    }
  }, {
    key: "createPlaylistCallback",
    value: function createPlaylistCallback(job) {
      console.log("CREATE PLAYLIST CALLBACK");
      console.log(job);
      this.emit("follow_playlist", {
        groupId: job.groupId,
        playlistId: job.playlistId
      });
      this.playlistCallback(job);
    }
  }, {
    key: "playlistCallback",
    value: function playlistCallback(job) {
      var _this5 = this;

      // TELL PARENT PROCESS THE PLAYLIST ID
      console.log("");
      console.log("PLAYLIST CALLBACK");
      console.log(job);

      if (typeof job.songUri != "undefined") {
        this.addToPlaylist(job.playlistId, job.songUri, job.groupId).then(function () {
          _this5.operations.dequeue();

          _this5.emit("playlist", {
            groupId: job.groupId,
            playlistId: job.playlistId
          });

          _this5.runCaller();
        });
      } else {
        this.operations.dequeue();
        this.emit("playlist", {
          groupId: job.groupId,
          playlistId: job.playlistId
        });
        this.runCaller();
      }
    }
  }, {
    key: "callerWait",
    value: function callerWait(time) {
      var _this6 = this;

      // console.log("RUNOEPRATION: TOO QUICK! MUST WAIT " + time + " SECONDS")
      setTimeout(function () {
        console.log("WAIT DONE! RUNNING RUN CALLER");

        _this6.runCaller();
      }, time * 1000);
    }
  }, {
    key: "createPlaylist",
    value: function createPlaylist(name, description, groupId, songUri) {
      var _this7 = this;

      return new Promise(function (resolve, reject) {
        var str = ""; // POST data

        var data = JSON.stringify({
          name: name,
          description: description,
          "public": false,
          collaborative: false
        }); // POST options

        var options = {
          hostname: apiEndpoint,
          path: "/v1/users/" + userId + "/playlists",
          port: 443,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + _this7.accessToken
          }
        };
        var req = https.request(options, function (res) {
          // If API limit is reached
          if (res.statusCode == 429) {
            console.log("CREATE PLAYLIST: GOT 429");
            console.log(res.headers);
            process.stdout.write(res.headers);
            console.log(" ^ HEADERS");
            res.headers["Retry-After"];
            reject(res.headers["Retry-After"]);
          }

          res.on("data", function (d) {
            str += d;
            console.log("GOT DATA!!!");
            process.stdout.write(d);
          });
          res.on("end", function () {
            resolve({
              groupId: groupId,
              playlistId: JSON.parse(str.toString()).id,
              songUri: songUri
            });
          });
        });
        req.on("error", function (e) {
          console.error("SPOTIFY ERROR");
          console.error(e);
        });
        req.end(data);
      });
    }
  }, {
    key: "addToPlaylist",
    value: function addToPlaylist(playlistId, songId, groupId) {
      var _this8 = this;

      console.log("MAKING PROMISE");
      return new Promise(function (resolve, reject) {
        var str = "";
        console.log("FR MAKING PROMISE..."); // POST data

        var data = JSON.stringify({
          uris: [songId]
        }); // POST options

        var options = {
          hostname: apiEndpoint,
          path: "/v1/playlists/" + playlistId + "/tracks",
          port: 443,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + _this8.accessToken
          }
        };
        var req = https.request(options, function (res) {
          // If API limit is reached
          if (res.statusCode == 429) {
            console.log("ADD TO PLAYLIST: GOT 429");
            console.log(res.headers);
            process.stdout.write(res.headers);
            console.log(" ^ HEADERS");
            res.headers["Retry-After"];
            reject(res.headers["Retry-After"]);
          }

          res.on("data", function (d) {
            str += d;
            console.log("GOT DATA!!!");
            process.stdout.write(d);
          });
          res.on("end", function () {
            resolve({
              groupId: groupId,
              playlistId: playlistId
            });
          });
        });
        req.on("error", function (e) {
          console.error("SPOTIFY ERROR");
          console.error(e);
        });
        req.end(data);
      });
    }
  }]);

  return SpotifyConnection;
}(EventEmitter);

module.exports = SpotifyConnection;