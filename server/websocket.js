var http = require('http');
var winston = require('winston');
var request = require('request');
var WebSocketServer = require('websocket').server;

var POLL_INTERVAL = 60 * 1000;

var url = 'https://data.seattle.gov/resource/3k2p-39jp.json?$where=event_clearance_date%20IS%20NOT%20NULL&$order=event_clearance_date%20DESC&$limit=25'

// Logging utilities to console and log files
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)(),
        new (winston.transports.File)({ filename: '/var/log/crime/ws.log' })
    ]
});

// HTTP backend and data
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
        logger.info('Websocket server is listening on port ' + port);
        logger.info('Updates set to refresh every ' + POLL_INTERVAL / 1000 + ' secs');

        // contact the Seattle Open Data API for latest updates
        request(url, function (err, res, body) {
            if (!err && res.statusCode == 200) {
                server.crimes = JSON.parse(body);
                server.isReady = true;
                logger.info('Websocket server is updated and ready');

                // start polling for new police events
                setInterval(function() {
                    if (server.isReady) {
                        fetchAndPushNewCrimes();
                    }
                }, POLL_INTERVAL);
            }
        });
    });
};

// The Websocket server that uses our HTTP backend for comms
wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: true
});

// Websocket event handlers
wsServer.on('connect', function(connection) {
    logger.info('Connected to ' + connection.remoteAddress);

    if (server.isReady) {
        connection.sendUTF(JSON.stringify({existing: server.crimes}));
        server.clients.push(connection);
    }

    connection.on('close', function(reasonCode, description) {
        logger.info('Peer ' + connection.remoteAddress + ' disconnected.');

        var index = server.clients.indexOf(connection);
        if (index != -1) {
            server.clients.splice(index, 1);
        }

    });
});

/*
 * HELPER FUNCTIONS
 */

// Fetch the latest 25 events.
// If new events are found (not within server.crimes), push
// new events to connected clients, and update server.crimes
var fetchAndPushNewCrimes = function() {
    request(url, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var fetchedCrimes = JSON.parse(body);

            logger.info('Refreshing crime data... ' +  
                'Fetched ' + fetchedCrimes.length + ' recent crimes');

            var hasNew = false;
            var numNewCrimes = 0;
            var newCrimes = [];

            for (i in fetchedCrimes) {
                var newCrime = fetchedCrimes[i];
                var isNew = true;

                // check existing crimes for newCrime
                for (j in server.crimes) {
                    if (crimesEqual(server.crimes[j], newCrime)) {
                        isNew = false;
                   }
                }

                if (isNew) {
                    hasNew = true;
                    numNewCrimes++;
                    newCrimes.push(newCrime);
                }
            }

            if (hasNew) {
                logger.info(numNewCrimes + ' new crimes found.');
                server.newCrimes = newCrimes;

                // remove the last (numNewCrimes) crimes from the array
                server.crimes.splice(server.crimes.length - numNewCrimes, numNewCrimes);

                // add the newest crimes in chronological order (newest first)
                for (i in newCrimes) {
                    server.crimes.splice(i, 0, newCrimes[i]);
                }

                // send to clients
                pushUpdates();
            }
        }
    });
};

/**
 * Check for crime object equality
 *
 * @return true iff the non-object fields of crime1 and crime2 
 *         are equivalent (===)
 */
var crimesEqual = function(crime1, crime2) {
    var equal = true;
    for (key in crime1) {
        if (!crime2.hasOwnProperty(key) || (crime2[key] !== crime1[key] && typeof crime1[key] !== 'object')) {
            equal = false;
        }
    }
    return equal;
}

/**
 * Send the latest updates in JSON format, where 'latest' means new
 * crimes since the last refresh interval.
 */
var pushUpdates = function() {
    logger.info('Pushing new crimes to clients: ');
    for (index in server.clients) {
        var connection = server.clients[index];
        connection.sendUTF(JSON.stringify({new: server.newCrimes}));
    }
    logger.info('Pushed updates to ' + server.clients.length + ' clients');
}

exports.server = server;

