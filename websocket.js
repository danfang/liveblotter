var WebSocketServer = require('websocket').server;
var http = require('http');
var winston = require('winston');
var request = require('request');

var url = 'https://data.seattle.gov/resource/3k2p-39jp.json?$where=event_clearance_date%20IS%20NOT%20NULL&$order=event_clearance_date%20DESC&$limit='

var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ filename: '/var/log/crime/ws.log' })
    ]
});

var server = http.createServer(function(request, response) {
    logger.info((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.isReady = false;
server.clients = [];
server.crimes = [];
server.newCrimes = [];

server.start = function(port, debug) {
    server.listen(port, function() {
        logger.info((new Date()) + ' Websocket server is listening on port ' + port);
        request(url + '25', function (err, res, body) {
            if (!err && res.statusCode == 200) {
                server.crimes = JSON.parse(body);
                server.isReady = true;
                logger.info('Websocket server is updated and ready.');
            }
        });
    });
};

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true
});

wsServer.on('connect', function(connection) {
    logger.info('Connected to ' + connection.remoteAddress);

    if (server.isReady) {
        connection.sendUTF(JSON.stringify(server.crimes));
    }

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            var content = message.utf8Data;

            if (content === 'debug') {
                for (index in server.crimes) {
                    console.log(server.crimes[index].event_clearance_description);
                }
            }
        }
        server.clients.push(connection);
    });

    connection.on('close', function(reasonCode, description) {
        logger.info('Peer ' + connection.remoteAddress + 
            ' disconnected.');

        var index = server.clients.indexOf(connection);

        if (index != -1) {
            server.clients = server.clients.splice(index, 1);
        }

    });
});

var interval = 60 * 1000;

setInterval(function() {
    if (server.isReady) {
        console.log('Refreshing crime data (interval = ' + interval + ')');
        fetchAndPushNewCrimes();
    }
}, interval);

var fetchAndPushNewCrimes = function() {
    request(url + '25', function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var fetchedCrimes = JSON.parse(body);
            console.log('Fetched ' + fetchedCrimes.length + ' recent crimes');
            var hasNew = false;
            var numNewCrimes = 0;
            var newCrimes = []

            for (i in fetchedCrimes) {
                var newCrime = fetchedCrimes[i];
                var isNew = true;

                for (j in server.crimes) {
                    if (crimesEqual(server.crimes[j], newCrime)) {
                        isNew = false;
                   }
                }

                if (isNew) {
                    server.crimes.splice(i, 0, newCrime);
                    removeOldest();
                    hasNew = true;
                    numNewCrimes++;
                    newCrimes.push(newCrime);
                }
            }

            if (hasNew) {
                console.log(numNewCrimes + ' new crimes found.');
                server.newCrimes = newCrimes;
                pushUpdates();
            }
        }
    });
};

var crimesEqual = function(crime1, crime2) {
    var equal = true;
    for (key in crime1) {
        if (!crime2.hasOwnProperty(key) || (crime2[key] !== crime1[key] && typeof crime1[key] !== 'object')) {
            equal = false;
        }
    }
    return equal;
}

var pushUpdates = function() {
    console.log('Pushing new crimes to clients: ');
    for (index in server.clients) {
        var connection = server.clients[index];
        console.log('Pushed to ' + connection.remoteAddress);
        connection.sendUTF(JSON.stringify(server.newCrimes));
    }
}

var removeOldest = function() {
    server.crimes = server.crimes.splice(server.crimes.length - 1, 1);
}

exports.server = server;

