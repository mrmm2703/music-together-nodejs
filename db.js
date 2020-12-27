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
            database: db_config.database
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

    // When a banned word was sent
    logBannedWord(word, spotifyId, groupId) {
        let sql = "INSERT INTO bannedWordsUse (banUsgWordID, banUsgSenderID, banUsgGroupID) " + 
        "VALUES ((SELECT wordID FROM bannedWords WHERE word=?), ?, ?)"
        let query = mysql.format(sql, [word, spotifyId, groupId])
        this.pool.query(query, (error, response) => {
            if (error) {
                console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId})`)
                console.error(error)
            } else {
                console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId}) - SUCCESS`)
            }
        })

        sql = "UPDATE bannedWords SET wordUses = wordUses + 1 WHERE word=?"
        query = mysql.format(sql, [word])
        this.pool.query(query, (error, response) => {
            if (error) {
                console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId})`)
                console.error(error)
            } else {
                console.error(`DatabasePool::logBannedWord(${word}, ${spotifyId}, ${groupId}) - SUCCESS`)
            }
        })
    }

    // Log a message
    logMessage(message, spotifyId, groupId) {
        let sql = "INSERT INTO messages (msgSenderID, msgContent, msgGroupID) VALUES (?,?,?)"
        let query = mysql.format(sql, [spotifyId, message, groupId])
        this.pool.query(query, (error, data) => {
            if (error) {
                console.log(`DatabasePool::logMessage(${message}, ${spotifyId}, ${groupId})`)
                console.log(error)
            } else {
                console.log(`DatabasePool::logMessage(${message}, ${spotifyId}, ${groupId}) - SUCCESS`)
            }
        })
    }
}

module.exports = DatabasePool