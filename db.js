// Import needed modules
const db_config = require("./db_config")
const mysql = require("mysql")

// Class to communicate with the database
class DatabasePool {
    // Constructor to create a MySQL pool
    constructor() {
        this.pool = mysql.createPool({
            connectionLimit: 100,
            host: db_config.host,
            user: db_config.username,
            password: db_config.password,
            database: db_config.database,
            charset: "utf8mb4"
        })
    }

    // Insert a group log
    insertGroupLog(spotifyId, groupId, action) {
        let sql = "INSERT INTO groupLogs (glogSpotifyID, glogGroupID, glogAction) VALUES (?,?,?)"
        let query = mysql.format(sql, [spotifyId, groupId, action])
        this.pool.query(query, (error, response) => {
            if (error) {
                console.error(`DatabasePool::insertGroupLog(${spotifyId}, ${groupId}, ${action})`)
                console.error(error)
            } else {
                console.log(`DatabasePool::insertGroupLog(${spotifyId}, ${groupId}, ${action}) - SUCCESS`)
            }
        })
    }

    // Update the userGroupID
    updateUserGroupId(spotifyId, groupId) {
        let sql = "UPDATE users SET userGroupID=? WHERE userSpotifyID=?"
        let query = mysql.format(sql, [groupId, spotifyId])
        this.pool.query(query, (error, response) => {
            if (error) {
                console.error(`DatabasePool::updateUserGroupId(${spotifyId}, ${groupId})`)
                console.error(error)
            } else {
                console.log(`DatabasePool::updateUserGroupId(${spotifyId}, ${groupId}) - SUCCESS`)
            }
        })
    }

    // Get the banned words
    getBannedWords() {
        let sql = "SELECT word FROM bannedWords"
        let words = []
        this.pool.query(sql, (error, data) => {
            if (error) {
                console.log("DatabasePool::getBannedWords()")
                console.log(error)
            } else {
                console.log("DatabasePool::getBannedWords() - SUCCESS")
                for (let i=0; i < data.length; i++) {
                    words.push(data[i]["word"])
                }
            }
        })
        return words
    }

    // Get number of banned words for a user in given past hours
    getRecentBannedWords(spotifyId, pastHours) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT COUNT(*) FROM bannedWordsUse WHERE banUsgDate ` + 
            `>= DATE_ADD(CURRENT_DATE(), INTERVAL -${pastHours} HOUR) AND banUsgSenderID = ?`
            let query = mysql.format(sql, [spotifyId])
            this.pool.query(query, (error, data) => {
                if (error) {
                    console.log(`DatabasePool::getRecentBannedWords(${spotifyId}, ${pastHours})`)
                    console.log(error)
                    reject(error)
                } else {
                    console.log(data)
                    resolve(data[0]["COUNT(*)"])
                }
            })
        })
    }

    // When a banned word was sent
    logBannedWord(word, spotifyId, groupId, message) {
        let sql = "INSERT INTO messages (msgSenderID, msgContent, msgGroupID) VALUES (?,?,?)"
        let query = mysql.format(sql, [spotifyId, message, groupId])
        let id;
        this.pool.query(query, (error, data) => {
            if (error) {
                console.log(`DatabasePool::logBannedWord[msg](${message}, ${spotifyId}, ${groupId})`)
                console.log(error)
            } else {
                console.log(`DatabasePool::logBannedWord[msg](${message}, ${spotifyId}, ${groupId}) - SUCCESS`)
                console.log(data.insertId)
                id = data.insertId

                sql = "INSERT INTO bannedWordsUse (banUsgWordID, banUsgSenderID, banUsgGroupID, banUsgMsgID) " + 
                "VALUES ((SELECT wordID FROM bannedWords WHERE word=?), ?, ?, ?)"
                query = mysql.format(sql, [word, spotifyId, groupId, id])
                this.pool.query(query, (error, response) => {
                    if (error) {
                        console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId}, ${id})`)
                        console.error(error)
                    } else {
                        console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId}, ${id}) - SUCCESS`)
                    }
                })
            }
        })
    }

    // Log a message
    logMessage(message, spotifyId, groupId) {
        let sql = "INSERT INTO messages (msgSenderID, msgContent, msgGroupID) VALUES (?,?,?)"
        let query = mysql.format(sql, [spotifyId, message, groupId])
        let id = "poop"
        this.pool.query(query, (error, data) => {
            if (error) {
                console.log(`DatabasePool::logMessage(${message}, ${spotifyId}, ${groupId})`)
                console.log(error)
            } else {
                console.log(`DatabasePool::logMessage(${message}, ${spotifyId}, ${groupId}) - SUCCESS`)
                console.log(data.insertId)
                id = data.insertId
            }
        })
        return id
    }

    // Ban a user
    banUser(spotifyId) {
        let sql = "UPDATE users SET userBanned = 1 WHERE userSpotifyID=?"
        let query = mysql.format(sql, [spotifyId])
        this.pool.query(query, (error, data) => {
            if (error) {
                console.log(`DatabasePool::banUser(${spotifyId})`)
                console.log(error)
            } else {
                return true
            }
        })
    }

    // Validation admin access token
    checkAccessToken(accessToken, callback) {
        let sql = "SELECT COUNT(adminID) AS 'count' FROM adminUsers WHERE adminToken=?"
        let query = mysql.format(sql, [accessToken])
        this.pool.query(query, (error, data) => {
            if (error) {
                console.log(`DatabasePool::checkAccessToken(${accessToken})`)
                console.log(error)
                callback(false)
            } else {
                console.log(`DatabasePool::checkAccessToken(${accessToken})`)
                if (data.length == 1) {
                    callback(true)
                } else {
                    callback(false)
                }
            }
        })
    }
}

module.exports = DatabasePool