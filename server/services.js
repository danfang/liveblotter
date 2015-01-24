var ws = require('./websocket.js').server;

var debug = true;

ws.start(6000, debug);
