// Import needed modules
const fs = require("fs")
const https = require("https")
const mysql = require("mysql")
const DatabasePool = require("./db")
const SpotifyConnection = require("./spotify")

// Create a DatabasePool object
var db = new DatabasePool()

var banned_words = db.getBannedWords()

// Create a HTTPS server
var server = https.createServer({
    key: fs.readFileSync("/home/azureuser/private.key"),
    cert: fs.readFileSync("/home/azureuser/certificate.crt")
})

// Initialise socket.io with CORS allowed
const io = require("socket.io")(server, {
    cors: {
        origin: "https://morahman.me",
        methods: ["GET", "POST"]
    }
})
server.listen(3000)

var spotify = new SpotifyConnection()

// var groups = {
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
//         },
//         "host": "hostSpotifyId",
//         "hostSocket": "hostSocketId"
//     }
// }

var groups = {}

spotify.on("follow_playlist", (data) => {
    console.log(data)
    groups[data.groupId]["collabId"] = data.playlistId
    io.to(data.groupId).emit("followPlaylist", data.playlistId)
})

spotify.on("playlist", (data) => {
    io.to(data.groupId).emit("updatePlaylist", data.playlistId)
})


function getDate() {
    let d = new Date()
    return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear()
}

// When a new connection is established
io.on("connection", (socket) => {
    console.log("New connection.")

    socket.on("auth_code", (code) => {
        spotify.activateAuthCode(code).then(function(d) {
            spotify.setToken(d)
            spotify.startRefreshSequence()
        })
    })

    // When admin changes banned words
    socket.on("refreshBannedWords", () => {
        banned_words = db.getBannedWords()
        console.log("Refreshing banned words...")
    })
    
    // When user joins for the first time
    socket.on("joinedGroup", (data) => {
        socket.spotifyId = data.id
        socket.group = data.group
        socket.join(data.group)
        // Check if group exists
        if (!groups.hasOwnProperty(socket.group)) {
            groups[socket.group] = {
                users: {},
                likes: {},
                queue: [],
                host: socket.spotifyId,
                hostSocket: socket.id,
                collabId: null
            }
        }
        // Add user to groups object
        groups[socket.group]["users"][socket.spotifyId] = {
            "prof_pic": data.prof_pic,
            "name": data.name,
            "socket": socket.id
        }

        // Send back a response to new user
        io.to(socket.id).emit("usersInGroup", groups[socket.group])

        // Tell all other users new user is here
        socket.to(socket.group).emit("newUser", {
            id: socket.spotifyId,
            prof_pic: groups[socket.group]["users"][socket.spotifyId]["prof_pic"],
            name: groups[socket.group]["users"][socket.spotifyId]["name"]
        })

        // Send collab playlist to new user if collab exists
        if (groups[socket.group]["collabId"] != null) {
            io.to(socket.id).emit("followPlaylist", groups[socket.group]["collabId"])
            io.to(socket.id).emit("updatePlaylist", groups[socket.group]["collabId"])
        }

        // Add an ENTER group log
        db.insertGroupLog(socket.spotifyId, socket.group, "ENTER")

        // Update users table with group ID
        db.updateUserGroupId(socket.spotifyId, socket.group)

        console.log(groups)
    })

    // When a weAreHere message is received from the host
    socket.on("weAreHere", (data) => {
        io.to(data.socketId).emit("weAreHere", {
            context: data.context,
            uri: data.uri,
            position: data.position,
            paused: data.paused,
            queue: groups[socket.group]["queue"],
            duration: data.duration
        })
    })

    socket.on("whereAreWe", () => {
        io.to(groups[socket.group]["hostSocket"]).emit("whereAreWe", socket.id)
    })

    // When user leaves a group session
    socket.on("disconnect", () => {
        if (typeof socket.spotifyId != "undefined") {
            // Add an EXIT group log
            db.insertGroupLog(socket.spotifyId, socket.group, "EXIT")

            // Tell other users that the user has disconnected
            io.to(socket.group).emit("userLeft", socket.spotifyId)

            // Remove the user from the groups object
            delete groups[socket.group]["users"][socket.spotifyId]

            // Remove group if empty
            if (Object.keys(groups[socket.group]["users"]).length == 0) {
                delete groups[socket.group]
            } else {
                if (groups[socket.group]["host"] == socket.spotifyId) {
                    // Assign a new host
                    groups[socket.group]["host"] = Object.keys(groups[socket.group]["users"])[0]
                    groups[socket.group]["hostSocket"] = groups[socket.group]["users"][groups[socket.group]["host"]]["socket"]   
                }
            }

            // Update users table with group ID
            db.updateUserGroupId(socket.spotifyId, null)
            console.log(groups)
        }
    })

    // When a message is received
    socket.on("message", (data) => {
        // Check if message contains banned word
        let banned = false
        let word;
        for (var i=0; i < banned_words.length; i++) {
            if (data.includes(banned_words[i])) {
                banned = true;
                word = banned_words[i]
                break
            }
        }

        if (banned) {
            // Tell client message was banned
            io.to(socket.id).emit("messageBanned", word)
            // Log banned word usage and message in database
            db.logBannedWord(word, socket.spotifyId, socket.group, data)
        } else {
            // Log the message in database
            db.logMessage(data, socket.spotifyId, socket.group)
            // Send to all clients new message
            io.to(socket.group).emit("newMessage", {
                id: socket.spotifyId,
                message: data
            })
        }

    })

    // When a user is typing
    socket.on("typing", () => {
        socket.to(socket.group).emit("typing", socket.spotifyId)
    })

    // PLAYBACK STATE CONTROLS
    socket.on("pause", () => {
        socket.to(socket.group).emit("pause", socket.spotifyId)
    })
    
    socket.on("resume", () => {
        socket.to(socket.group).emit("resume", socket.spotifyId)
    })

    socket.on("seek", (pos) => {
        socket.to(socket.group).emit("seek", {
            id: socket.spotifyId,
            pos: pos
        })
    })

    // SONG CONTROL
    socket.on("changeSong", (songDetails) => {
        if (groups[socket.group]["host"] == socket.spotifyId) {
            socket.to(socket.group).emit("changeSong", {
                uri: songDetails.uri,
                context: songDetails.context,
                paused: songDetails.paused,
                name: songDetails.name,
                id: socket.spotifyId
            })
            if (groups[socket.group]["queue"].includes(songDetails.uri)) {
                groups[socket.group]["queue"].splice(groups[socket.group]["queue"].indexOf(songDetails.uri), 1)
            }
            console.log(groups[socket.group]["queue"])
        }
    })

    socket.on("addToQueue", (data) => {
        socket.to(socket.group).emit("addToQueue", {
            uri: data.uri,
            name: data.name,
            artist: data.artist,
            image: data.image,
            id: socket.spotifyId
        })
        groups[socket.group].queue.push(data.uri)
        console.log(groups[socket.group]["queue"])
    })

    socket.on("makeMeHost", () => {
        groups[socket.group]["host"] = socket.spotifyId
        groups[socket.group]["hostSocket"] = socket.id
    })

    // USER BAN
    socket.on("banUser", (data) => {
        // Check for access token
        if (data.accessToken != null) {
            // Check if access token is valid
            db.checkAccessToken(data.accessToken, function(res) {
                if (res) {
                    // Find the socket ID of the user by Spotify ID
                    for (const [key, value] of Object.entries(groups)) {
                        for (const [user_id, user_details] of Object.entries(value["users"])) {
                            if (user_id == data.id) {
                                io.to(user_details["socket"]).emit("userBanned")
                            }
                        }
                    }
                }
            })
        }
    })

    // COLLABORATIVE PLAYLIST
    socket.on("addToPlaylist", (songUri) => {
        console.log("songUri:")
        console.log(songUri)
        if (groups[socket.group]["collabId"] == null) {
            spotify.addToQueue("create_playlist", {
                name: "Collab (" + socket.group + ")",
                description: "Music Together session on " + getDate() + ". Group ID: " + socket.group,
                songUri: "spotify:track:" + songUri
            }, socket.group)
        } else {
            spotify.addToQueue("add_to_playlist", {
                playlistId: groups[socket.group]["collabId"],
                songId: "spotify:track:" + songUri
            }, socket.group)
        }
    })

    socket.on("newPlaylist", (data) => {
        groups[socket.group]["collabId"] = data.collabUri
        // Broadcast to rest of group the new playlist
        socket.to(socket.group).emit("followPlaylist", data.collabUri)
        // Tell client to add to playlist
        io.to(socket.id).emit("collabUri", {
            songId: data.songId,
            collabUri: groups[socket.group]["collabId"]
        })
    })

    socket.on("newPlaylistItem", () => {
        socket.to(socket.group).emit("updatePlaylist", groups[socket.group]["collabId"])
    })

    // SETTINGS CHANGES
    socket.on("changeName", (newName) => {
        groups[socket.group]["users"][socket.spotifyId]["name"] = newName
        io.to(socket.group).emit("updateName", {
            id: socket.spotifyId,
            name: newName
        })
    })

    socket.on("changeProfPic", (newProfPic) => {
        groups[socket.group]["users"][socket.spotifyId]["prof_pic"] = newProfPic
        io.to(socket.group).emit("updateProfPic", {
            id: socket.spotifyId,
            profPic: newProfPic
        })
    })
})
