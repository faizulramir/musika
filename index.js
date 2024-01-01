const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const crypto = require("crypto");
const fs = require('node:fs');

async function main() {
  // open the database file
  const db = await open({
    filename: 'musika.db',
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS room (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS player (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        username TEXT,
        room_id TEXT,
        score TEXT
    );
  `);

  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  app.use(express.static(__dirname + '/src'));

  app.get('/', (req, res) => {
    res.sendFile(express.static(__dirname + 'index.html'));
  });

  io.on('connection', (socket) => {
    const userID = socket.id;

    socket.on('disconnect', async () => {
      let result;
      let player;
      let players;
      let msg;
      let code = 200;
      let room_id = null

      try {
        player = await db.all("SELECT * FROM player WHERE name = (?)", userID)
        if (player.length > 0)  {
          room_id = player[0].room_id;
          await db.run('DELETE FROM player WHERE name = (?)', userID);

          players = await db.all("SELECT * FROM player WHERE room_id = (?)", room_id)
          if (player.length === 1) {
            await db.run('DELETE FROM room WHERE name = (?)', room_id);
          }
          msg = userID + " left."
        } else {
          code = 404
          msg = "Error!"
        }
      } catch (e) {
        code = 404
        msg = "Error!"
      }

      io.emit('userActivity',{ 
        "players": players && players.length > 0 ? players : [],
        // "player": player,
        "room": room_id,
        "code": code,
        "msg": msg,
        "event": "disconnected"
      });
    });

    socket.on('leaveRoom', async (data) => {
      let result;
      let player;
      let players;
      let msg;
      let code = 200;
      let room_id = null

      try {
        player = await db.all("SELECT * FROM player WHERE name = (?)", data.userID)
        if (player.length > 0)  {
          await db.run('DELETE FROM player WHERE name = (?)', data.userID);

          players = await db.all("SELECT * FROM player WHERE room_id = (?)", data.roomID)
          if (players.length === 0) {
            await db.run('DELETE FROM room WHERE name = (?)', data.roomID);
          }
          msg = data.userID + " left."
        } else {
          code = 404
          msg = "Error!"
        }
      } catch (e) {
        code = 404
        msg = "Error!"
      }

      io.emit('userActivity',{ 
        "players": players && players.length > 0 ? players : [],
        "player": data.userID,
        "room": data.roomID,
        "code": code,
        "msg": msg,
        "event": "leaveRoom"
      });
    });

    socket.on('createRoom',async (data) => {
      const roomID = crypto.randomBytes(3).toString("hex");
      let players;
      let room;
      let msg;
      let code = 200;

      try {
        await db.run('INSERT INTO room (name) VALUES (?)', roomID);
        await db.run('INSERT INTO player (name, username, room_id) VALUES (:userID, :username, :roomID)', {
          ':userID': userID,
          ':username': data.username,
          ':roomID': roomID,
        })
        players = await db.all("SELECT * FROM player WHERE room_id = (?)", roomID)
      } catch (e) {
        console.log(e)
        code = 404
        msg = "Error!"
      }

      io.emit('userActivity',{ 
        "players": players,
        "player": userID,
        "room": roomID,
        "code": code,
        "msg": msg,
        "event": "createRoom"
      });
    });

    socket.on('joinRoom',async (data) => {
      let players;
      let room;
      let msg;
      let code = 200;

      try {
        let room = await db.all("SELECT * FROM room WHERE name = (?)", data.roomID)
        if (room.length === 0) {
          code = 404
          msg = "Room not found!"
        } else {
          await db.run('INSERT INTO player (name, username, room_id) VALUES (:userID, :username, :roomID)', {
            ':username': data.username,
            ':userID': data.userID,
            ':roomID': data.roomID,
          })
          players = await db.all("SELECT * FROM player WHERE room_id = (?)", data.roomID)
        }
        
      } catch (e) {
        code = 404
        msg = "Error!"
      }
  
      io.emit('userActivity',{ 
        "players": players && players.length > 0 ? players : [],
        "player": userID,
        "room": data.roomID,
        "code": code,
        "msg": msg,
        "event": "joinRoom"
      });
    });

    socket.on('startGame',async (data) => {
      let code = 200
      let msg = "Success!"
      let players
      try {
        players = await db.all("SELECT * FROM player WHERE room_id = (?)", data.roomID)
        let room = await db.all("SELECT * FROM room WHERE name = (?)", data.roomID)
        if (room.length === 0) {
          code = 404
          msg = "Room not found!"
        }
      } catch (e) {
        code = 404
        msg = "Error!"
      }

      const folderName = './src/assets/songs/' + data.genre;

      fs.readdir(folderName, (err, files) => {
        const randomFolder = files[Math.floor(Math.random() * files.length)];
        fs.readdir(folderName + '/' + randomFolder, (err, song) => {
          const randomSong = song[Math.floor(Math.random() * song.length)];

          let answers = shuffle([
            files[Math.floor(Math.random() * files.length)],
            files[Math.floor(Math.random() * files.length)],
            files[Math.floor(Math.random() * files.length)],
            randomFolder
          ])

          let hasDuplicate = answers.some((val, i) => answers.indexOf(val) !== i);
          if (hasDuplicate) {
            answers = shuffle([
              files[Math.floor(Math.random() * files.length)],
              files[Math.floor(Math.random() * files.length)],
              files[Math.floor(Math.random() * files.length)],
              randomFolder
            ])
          }
          
          io.emit('gameActivity',{
            "song": randomSong,
            "answers": answers,
            "answer": randomFolder,
            "songPath": '/assets/songs/' + data.genre + '/' + randomFolder + '/' + randomSong,
            "room": data.roomID,
            "code": code,
            "msg": msg,
            "event": "startGame",
            "level": 1,
            "players": players
          });
        });
      });
    });

    socket.on('nextLevel',async (data) => {
      let code = 200
      let msg = "Success!"
      let players
      try {
        players = await db.all("SELECT * FROM player WHERE room_id = (?)", data.roomID)
        let room = await db.all("SELECT * FROM room WHERE name = (?)", data.roomID)
        if (room.length === 0) {
          code = 404
          msg = "Room not found!"
        }
      } catch (e) {
        code = 404
        msg = "Error!"
      }

      const folderName = './src/assets/songs/' + data.genre;

      fs.readdir(folderName, (err, files) => {
        const randomFolder = files[Math.floor(Math.random() * files.length)];
        fs.readdir(folderName + '/' + randomFolder, (err, song) => {
          const randomSong = song[Math.floor(Math.random() * song.length)];

          let answers = shuffle([
            files[Math.floor(Math.random() * files.length)],
            files[Math.floor(Math.random() * files.length)],
            files[Math.floor(Math.random() * files.length)],
            randomFolder
          ])

          let hasDuplicate = answers.some((val, i) => answers.indexOf(val) !== i);
          if (hasDuplicate) {
            answers = shuffle([
              files[Math.floor(Math.random() * files.length)],
              files[Math.floor(Math.random() * files.length)],
              files[Math.floor(Math.random() * files.length)],
              randomFolder
            ])
          }
          
          io.emit('gameActivity',{
            "song": randomSong,
            "answers": answers,
            "answer": randomFolder,
            "songPath": '/assets/songs/' + data.genre + '/' + randomFolder + '/' + randomSong,
            "room": data.roomID,
            "code": code,
            "msg": msg,
            "event": "nextLevel",
            "level": data.level,
            "players": players
          });
        });
      });
    });

    socket.on('gameFinished',async (data) => {
      let player
      try {
        await db.run('UPDATE player SET score = :score WHERE name = :userID', {
          ':score': data.score,
          ':userID': data.userID,
        })
        player = await db.all("SELECT * FROM player WHERE room_id = (?)", data.roomID)
        if (room.length === 0) {
          code = 404
          msg = "Room not found!"
        }
      } catch (e) {
        code = 404
        msg = "Error!"
      }

      io.emit('gameActivity',{
        "room": data.roomID,
        "players": player,
        "event": "gameFinished",
      });
    })

    function shuffle(array) {
      let currentIndex = array.length,  randomIndex;
    
      // While there remain elements to shuffle.
      while (currentIndex > 0) {
    
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
    
        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
          array[randomIndex], array[currentIndex]];
      }
    
      return array;
    }
  });

  server.listen(3000, () => {
    console.log('server running at http://localhost:3000');
  })
}

main()