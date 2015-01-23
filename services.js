var ws = require('./websocket.js').server;

var debug = true;

ws.start(8080, debug);
