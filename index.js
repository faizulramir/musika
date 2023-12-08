let app = require('express')();
let server = require('http').createServer(app);
let io = require('socket.io')(server, {
    cors: {
      origin: ["http://localhost:8100", "http://192.168.100.2:8100"],
      credentials: true
    }
  });
const cors = require('cors');
app.use(cors());

io.on('connection', (socket) => {
  socket.on('disconnect', function(){
    // io.emit('usersActivity', {
    //   user: socket.username,
    //   event: 'chatLeft'
    // });
  });

  socket.on('setOffline', (name) => {
    socket.username = name;
    io.emit('userStatus', {
      user: socket.username,
      event: 'chatLeft'
    });   
  });

  socket.on('setOnline', (name) => {
    socket.username = name;
    io.emit('userStatus', {
      user: name,
    });    
  });
  
  socket.on('setUserName', (name) => {
    socket.username = name;
    io.emit('usersActivity', {
      user: name,
      event: 'chatJoined'
    });    
  });
  
  socket.on('sendTheMessage', (message) => {
    io.emit('message', {
      msg: message.text,
      user: socket.username,
      createdAt: new Date()
    });    
  });
});

let port = process.env.PORT || 3000;
let ipAddress = '192.168.100.2'
server.listen(port, ipAddress);