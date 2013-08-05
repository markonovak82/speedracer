var express = require('express'),
	app     = require('express')(),
	server  = require('http').createServer(app),
	io 	    = require('socket.io').listen(server);

// use heroku port or 3000, use static IP so it works on phone too
server.listen(process.env.PORT || 3000, '192.168.0.77');

// set views and public path
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

// show first page with instructions
app.get('/', function (req, res) {
	res.sendfile(__dirname + '/views/index.html');
});

// show controls page
app.get('/controls', function (req, res) {
	res.sendfile(__dirname + '/views/controls.html');
});

// show game page
app.get('/game', function (req, res) {
	res.sendfile(__dirname + '/views/game.html');
});	

// uncomment this if the game will be running on heroku
// io.configure(function () { 
//   io.set("transports", ["xhr-polling"]); 
//   io.set("polling duration", 10); 
// });

// establish connection and listen for turnirng events
io.sockets.on('connection', function (socket) {
	socket.on('turning', function (data) {
	 	io.sockets.emit('wheel', { position: data.position });
	});
});