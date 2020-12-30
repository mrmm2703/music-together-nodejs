// Import needed modules
const fs = require("fs")
const https = require("https")
const mysql = require("mysql")
const DatabasePool = require("./db")

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

// When a new connection is established
io.on("connection", (socket) => {
    console.log("New connection.")
    console.log(banned_words)
    
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
                host: socket.spotifyId,
                hostSocket: socket.id
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
            paused: data.paused
        })
    })

    socket.on("whereAreWe", () => {
        io.to(groups[socket.group]["hostSocket"]).emit("whereAreWe", socket.id)
    })

    // When user leaves a group session
    socket.on("disconnect", () => {
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

    // PLAYBACK CONTROLS
    socket.on("pause", () => {
        socket.to(socket.group).emit("pause", socket.spotifyId)
    })
    
    socket.on("resume", () => {
        socket.to(socket.group).emit("resume", socket.spotifyId)
    })

    socket.on("changeSong", (songDetails) => {
        if (groups[socket.group]["host"] == socket.spotifyId) {
            socket.to(socket.group).emit("changeSong", {
                uri: songDetails.uri,
                context: songDetails.context,
                paused: songDetails.paused,
                name: songDetails.name,
                id: socket.spotifyId
            })
        }
    })

    socket.on("addToQueue", (songDetails) => {
        socket.to(socket.group).emit("addToQueue", songDetails)
    })

    socket.on("makeMeHost", () => {
        groups[socket.group]["host"] = socket.spotifyId
        groups[socket.group]["hostSocket"] = socket.id
    })
})