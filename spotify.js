const https = require("https")
const querystring = require("querystring")
const queue = require("./queue")
const EventEmitter = require("events")

const clientId = "4a8fd972e1764fb8ac898d19335a9081"
const clientSecret = "bfd33fd015ef48a4a39cd121b87f7091"
const base64auth = Buffer.from(clientId + ":" + clientSecret).toString("base64")
const scope = "playlist-modify-public playlist-modify-private"
const userId = "u051288nb9jvms048f9zqxn42"

const apiEndpoint = "api.spotify.com"
const redirectUri = "https://morahman.me/musictogether/auth/show_token.php"

class SpotifyConnection extends EventEmitter {
    constructor() {
        super()
        console.log("Get authorisation code from:")
        console.log("https://accounts.spotify.com/authorize?client_id=" + 
        clientId + "&response_type=code&redirect_uri=" + redirectUri + 
        "&scope=" + scope)
        this.accessToken = null
        this.refreshToken = null
        this.tokenExpires = null
        this.operations = new queue()
        this.running = false
    }

    activateAuthCode(codeReq) {
        return new Promise((resolve, reject) => {
            // POST body
            let data = querystring.stringify({
                grant_type: "authorization_code",
                code: codeReq,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret
            })

            // POST options
            let authCodeOptions = {
                hostname: "accounts.spotify.com",
                path: "/api/token",
                port: 443,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": Buffer.byteLength(data)
                }
            }

            let req = https.request(authCodeOptions, res => {
                res.on("data", d => {
                    resolve(JSON.parse(d.toString()))
                })
            })

            req.on("error", e => {
                reject(e)
            })

            req.end(data)
        })
    }

    setToken(data) {
        console.log(data)
        console.log("")
        this.accessToken = data.access_token
        this.refreshToken = (typeof(data.refresh_token) == "undefined" ? this.refreshToken : data.refresh_token)
        this.tokenExpires = data.expires_in
    }

    startRefreshSequence() {
        setTimeout(() => {
            console.log("Refreshing token...")
            this.refreshAccessToken().then((d) => {
                this.setToken(d)
                console.log("New token: " + this.accessToken)
                console.log("New refresh token: " + this.refreshToken)
                console.log("Expires in: " + this.tokenExpires)
                this.startRefreshSequence()
            })
        }, (this.tokenExpires - 15) * 1000)
    }

    refreshAccessToken() {
        return new Promise((resolve, reject) => {
            // POST data
            let data = querystring.stringify({
                grant_type: "refresh_token",
                refresh_token: this.refreshToken
            })

            // POST options
            let options = {
                hostname: "accounts.spotify.com",
                path: "/api/token",
                port: 443,
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Content-Length": Buffer.byteLength(data),
                    "Authorization": "Basic " + base64auth
                }
            }

            let req = https.request(options, res => {
                res.on("data", d => {
                    resolve(JSON.parse(d.toString()))
                })
            })

            req.on("error", e => {
                reject(e)
            })

            req.end(data)
        })
    }

    addToQueue(type, data, groupId) {
        console.log("ADDING TO QUEUE")
        this.operations.enqueue({
            type: type,
            data: data,
            groupId: groupId
        })
        console.log("IN QUEUE:")
        console.log(this.operations.peek())
        if (this.running == false) {
            console.log("NOT RUNNING. RUNNING RUNCALLER")
            this.runCaller()
        }
    }

    runCaller() {
        // Check if no more operations are in the queue
        if (this.operations.isEmpty()) {
            console.log("OPERATIONS IS EMPTY")
            this.running = false
        } else {
            console.log("OPERATIONS IS NOT EMPTY. RUNNING RUNOPERATION")
            this.running = true
            this.runOperation()
        }
    }

    runOperation() {
        let operation = this.operations.peek()
        console.log("NEW OPERATION:")
        console.log(operation)
        console.log("")
        if (operation.type == "create_playlist") {
            console.log("RUNOPERATION FOUND A CREATE PLAYLIST COMMAND")

            this.createPlaylist(operation.data.name, operation.data.description, operation.groupId, operation.data.songUri)
                .then((job) => this.createPlaylistCallback(job),
                      (waitTime) => this.callerWait(waitTime))
        } else if (operation.type == "add_to_playlist") {
            console.log("ADD TO PLAYLIST FOUND")

            this.addToPlaylist(operation.data.playlistId, operation.data.songId, operation.groupId)
                .then((job) => this.playlistCallback(job),
                      (waitTime) => this.callerWait(waitTime))
        }
    }

    createPlaylistCallback(job) {
        console.log("CREATE PLAYLIST CALLBACK")
        console.log(job)
        this.emit("follow_playlist", {
            groupId: job.groupId,
            playlistId: job.playlistId
        })
        this.playlistCallback(job)
    }

    playlistCallback(job) {
        // TELL PARENT PROCESS THE PLAYLIST ID
        console.log("")
        console.log("PLAYLIST CALLBACK")
        console.log(job)
        if (typeof(job.songUri) != "undefined") {
            this.addToPlaylist(job.playlistId, job.songUri, job.groupId).then(() => {
                this.operations.dequeue()
                this.emit("playlist", {
                    groupId: job.groupId,
                    playlistId: job.playlistId
                })
                this.runCaller()
            })
        } else {
            this.operations.dequeue()
            this.emit("playlist", {
                groupId: job.groupId,
                playlistId: job.playlistId
            })
            this.runCaller()
        }
    }

    callerWait(time) {
        // console.log("RUNOEPRATION: TOO QUICK! MUST WAIT " + time + " SECONDS")
        setTimeout(() => {
            console.log("WAIT DONE! RUNNING RUN CALLER")
            this.runCaller()
        }, time * 1000);
    }

    createPlaylist(name, description, groupId, songUri) {
        return new Promise((resolve, reject) => {
            let str = ""
            // POST data
            let data = JSON.stringify({
                name: name,
                description: description,
                public: false,
                collaborative: false
            })

            // POST options
            let options = {
                hostname: apiEndpoint,
                path: "/v1/users/" + userId + "/playlists",
                port: 443,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.accessToken
                }
            }

            let req = https.request(options, res => {
                // If API limit is reached
                if (res.statusCode == 429) {
                    console.log("CREATE PLAYLIST: GOT 429")
                    console.log(res.headers)
                    process.stdout.write(res.headers)
                    console.log(" ^ HEADERS")
                    res.headers["Retry-After"]
                    reject(res.headers["Retry-After"])
                }
                res.on("data", d => {
                    str += d
                    console.log("GOT DATA!!!")
                    process.stdout.write(d)
                })
                res.on("end", () => {
                    resolve({
                        groupId: groupId,
                        playlistId: JSON.parse(str.toString()).id,
                        songUri: songUri
                    })
                })
            })

            req.on("error", e => {
                console.error("SPOTIFY ERROR")
                console.error(e)
            })

            req.end(data)
        })
    }

    addToPlaylist(playlistId, songId, groupId) {
        console.log("MAKING PROMISE")
        return new Promise((resolve, reject) => {
            let str = ""
            console.log("FR MAKING PROMISE...")
            // POST data
            let data = JSON.stringify({
                uris: [songId]
            })

            // POST options
            let options = {
                hostname: apiEndpoint,
                path: "/v1/playlists/" + playlistId + "/tracks",
                port: 443,
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + this.accessToken
                }
            }

            let req = https.request(options, res => {
                // If API limit is reached
                if (res.statusCode == 429) {
                    console.log("ADD TO PLAYLIST: GOT 429")
                    console.log(res.headers)
                    process.stdout.write(res.headers)
                    console.log(" ^ HEADERS")
                    res.headers["Retry-After"]
                    reject(res.headers["Retry-After"])
                }

                res.on("data", d => {
                    str += d
                    console.log("GOT DATA!!!")
                    process.stdout.write(d)
                })
                res.on("end", () => {
                    resolve({
                        groupId: groupId,
                        playlistId: playlistId
                    })
                })
            })

            req.on("error", e => {
                console.error("SPOTIFY ERROR")
                console.error(e)
            })

            req.end(data)
        })
    }
}

module.exports = SpotifyConnection