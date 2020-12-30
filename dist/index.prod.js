"use strict";var fs=require("fs"),https=require("https"),mysql=require("mysql"),DatabasePool=require("./db"),db=new DatabasePool,banned_words=db.getBannedWords(),server=https.createServer({key:fs.readFileSync("/home/azureuser/private.key"),cert:fs.readFileSync("/home/azureuser/certificate.crt")}),io=require("socket.io")(server,{cors:{origin:"https://morahman.me",methods:["GET","POST"]}});server.listen(3e3);var groups={};io.on("connection",function(t){console.log("New connection."),console.log(banned_words),t.on("joinedGroup",function(o){t.spotifyId=o.id,t.group=o.group,t.join(o.group),groups.hasOwnProperty(t.group)||(groups[t.group]={users:{},likes:{},host:t.spotifyId}),groups[t.group].users[t.spotifyId]={prof_pic:o.prof_pic,name:o.name},io.to(t.id).emit("usersInGroup",groups[t.group]),t.to(t.group).emit("newUser",{id:t.spotifyId,prof_pic:groups[t.group].users[t.spotifyId].prof_pic,name:groups[t.group].users[t.spotifyId].name}),db.insertGroupLog(t.spotifyId,t.group,"ENTER"),db.updateUserGroupId(t.spotifyId,t.group),console.log(groups)}),t.on("disconnect",function(){db.insertGroupLog(t.spotifyId,t.group,"EXIT"),io.to(t.group).emit("userLeft",t.spotifyId),delete groups[t.group].users[t.spotifyId],0==Object.keys(groups[t.group].users).length&&delete groups[t.group],db.updateUserGroupId(t.spotifyId,null),console.log(groups)}),t.on("message",function(o){for(var e,r=!1,s=0;s<banned_words.length;s++)if(o.includes(banned_words[s])){r=!0,e=banned_words[s];break}r?(io.to(t.id).emit("messageBanned",e),db.logBannedWord(e,t.spotifyId,t.group,o)):(db.logMessage(o,t.spotifyId,t.group),io.to(t.group).emit("newMessage",{id:t.spotifyId,message:o}))}),t.on("typing",function(){t.to(t.group).emit("typing",t.spotifyId)}),t.on("pause",function(){t.to(t.group).emit("pause")}),t.on("resume",function(){t.to(t.group).emit("resume")}),t.on("changeSong",function(o){groups[t.group].host==t.spotifyId&&t.to(t.group).emit("changeSong",{uri:o.uri,context:o.context})}),t.on("addToQueue",function(o){t.to(t.group).emit(o)}),t.on("makeMeHost",function(){groups[t.group].host=t.spotifyId})});