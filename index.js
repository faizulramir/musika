let app = require('express')();
let server = require('http').createServer(app);
let io = require('socket.io')(server, {
    cors: {
      origin: "http://localhost:8100",
      credentials: true
    }
  });
const cors = require('cors');
app.use(cors());

io.on('connection', (socket) => {
    socket.on('disconnect', function(){
      io.emit('usersActivity', {
        user: socket.username,
        event: 'chatLeft'
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
server.listen(port, () => {
    console.log('Server Started');
});