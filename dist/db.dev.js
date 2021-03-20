"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } }

function _createClass(Constructor, protoProps, staticProps) { if (protoProps) _defineProperties(Constructor.prototype, protoProps); if (staticProps) _defineProperties(Constructor, staticProps); return Constructor; }

// Import needed modules
var db_config = require("./db_config");

var mysql = require("mysql"); // Class to communicate with the database


var DatabasePool =
/*#__PURE__*/
function () {
  // Constructor to create a MySQL pool
  function DatabasePool() {
    _classCallCheck(this, DatabasePool);

    this.pool = mysql.createPool({
      connectionLimit: 100,
      host: db_config.host,
      user: db_config.username,
      password: db_config.password,
      database: db_config.database,
      charset: "utf8mb4"
    });
  } // Insert a group log


  _createClass(DatabasePool, [{
    key: "insertGroupLog",
    value: function insertGroupLog(spotifyId, groupId, action) {
      var sql = "INSERT INTO groupLogs (glogSpotifyID, glogGroupID, glogAction) VALUES (?,?,?)";
      var query = mysql.format(sql, [spotifyId, groupId, action]);
      this.pool.query(query, function (error, response) {
        if (error) {
          console.error("DatabasePool::insertGroupLog(".concat(spotifyId, ", ").concat(groupId, ", ").concat(action, ")"));
          console.error(error);
        } else {
          console.log("DatabasePool::insertGroupLog(".concat(spotifyId, ", ").concat(groupId, ", ").concat(action, ") - SUCCESS"));
        }
      });
    } // Update the userGroupID

  }, {
    key: "updateUserGroupId",
    value: function updateUserGroupId(spotifyId, groupId) {
      var sql = "UPDATE users SET userGroupID=? WHERE userSpotifyID=?";
      var query = mysql.format(sql, [groupId, spotifyId]);
      this.pool.query(query, function (error, response) {
        if (error) {
          console.error("DatabasePool::updateUserGroupId(".concat(spotifyId, ", ").concat(groupId, ")"));
          console.error(error);
        } else {
          console.log("DatabasePool::updateUserGroupId(".concat(spotifyId, ", ").concat(groupId, ") - SUCCESS"));
        }
      });
    } // Get the banned words

  }, {
    key: "getBannedWords",
    value: function getBannedWords() {
      var sql = "SELECT word FROM bannedWords";
      var words = [];
      this.pool.query(sql, function (error, data) {
        if (error) {
          console.log("DatabasePool::getBannedWords()");
          console.log(error);
        } else {
          console.log("DatabasePool::getBannedWords() - SUCCESS");

          for (var i = 0; i < data.length; i++) {
            words.push(data[i]["word"]);
          }
        }
      });
      return words;
    } // Get number of banned words for a user in given past hours

  }, {
    key: "getRecentBannedWords",
    value: function getRecentBannedWords(spotifyId, pastHours) {
      var _this = this;

      return new Promise(function (resolve, reject) {
        var sql = "SELECT COUNT(*) FROM bannedWordsUse WHERE banUsgDate " + ">= DATE_ADD(CURRENT_DATE(), INTERVAL -".concat(pastHours, " HOUR) AND banUsgSenderID = ?");
        var query = mysql.format(sql, [spotifyId]);

        _this.pool.query(query, function (error, data) {
          if (error) {
            console.log("DatabasePool::getRecentBannedWords(".concat(spotifyId, ", ").concat(pastHours, ")"));
            console.log(error);
            reject(error);
          } else {
            console.log(data);
            resolve(data[0]["COUNT(*)"]);
          }
        });
      });
    } // When a banned word was sent

  }, {
    key: "logBannedWord",
    value: function logBannedWord(word, spotifyId, groupId, message) {
      var _this2 = this;

      var sql = "INSERT INTO messages (msgSenderID, msgContent, msgGroupID) VALUES (?,?,?)";
      var query = mysql.format(sql, [spotifyId, message, groupId]);
      var id;
      this.pool.query(query, function (error, data) {
        if (error) {
          console.log("DatabasePool::logBannedWord[msg](".concat(message, ", ").concat(spotifyId, ", ").concat(groupId, ")"));
          console.log(error);
        } else {
          console.log("DatabasePool::logBannedWord[msg](".concat(message, ", ").concat(spotifyId, ", ").concat(groupId, ") - SUCCESS"));
          console.log(data.insertId);
          id = data.insertId;
          sql = "INSERT INTO bannedWordsUse (banUsgWordID, banUsgSenderID, banUsgGroupID, banUsgMsgID) " + "VALUES ((SELECT wordID FROM bannedWords WHERE word=?), ?, ?, ?)";
          query = mysql.format(sql, [word, spotifyId, groupId, id]);

          _this2.pool.query(query, function (error, response) {
            if (error) {
              console.error("DatabasePool::logBannedWord(".concat(word, ", ").concat(spotifyId, ", ").concat(groupId, ", ").concat(id, ")"));
              console.error(error);
            } else {
              console.error("DatabasePool::logBannedWord(".concat(word, ", ").concat(spotifyId, ", ").concat(groupId, ", ").concat(id, ") - SUCCESS"));
            }
          });
        }
      });
    } // Log a message

  }, {
    key: "logMessage",
    value: function logMessage(message, spotifyId, groupId) {
      var sql = "INSERT INTO messages (msgSenderID, msgContent, msgGroupID) VALUES (?,?,?)";
      var query = mysql.format(sql, [spotifyId, message, groupId]);
      var id = "poop";
      this.pool.query(query, function (error, data) {
        if (error) {
          console.log("DatabasePool::logMessage(".concat(message, ", ").concat(spotifyId, ", ").concat(groupId, ")"));
          console.log(error);
        } else {
          console.log("DatabasePool::logMessage(".concat(message, ", ").concat(spotifyId, ", ").concat(groupId, ") - SUCCESS"));
          console.log(data.insertId);
          id = data.insertId;
        }
      });
      return id;
    } // Ban a user

  }, {
    key: "banUser",
    value: function banUser(spotifyId) {
      var sql = "UPDATE users SET userBanned = 1 WHERE userSpotifyID=?";
      var query = mysql.format(sql, [spotifyId]);
      this.pool.query(query, function (error, data) {
        if (error) {
          console.log("DatabasePool::banUser(".concat(spotifyId, ")"));
          console.log(error);
        } else {
          return true;
        }
      });
    } // Validation admin access token

  }, {
    key: "checkAccessToken",
    value: function checkAccessToken(accessToken, callback) {
      var sql = "SELECT COUNT(adminID) AS 'count' FROM adminUsers WHERE adminToken=?";
      var query = mysql.format(sql, [accessToken]);
      this.pool.query(query, function (error, data) {
        if (error) {
          console.log("DatabasePool::checkAccessToken(".concat(accessToken, ")"));
          console.log(error);
          callback(false);
        } else {
          console.log("DatabasePool::checkAccessToken(".concat(accessToken, ")"));

          if (data.length == 1) {
            callback(true);
          } else {
            callback(false);
          }
        }
      });
    }
  }]);

  return DatabasePool;
}();

module.exports = DatabasePool;