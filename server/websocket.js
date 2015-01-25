var http = require('http');
var winston = require('winston');
var request = require('request');
var WebSocketServer = require('websocket').server;

var appToken = process.env.APP_TOKEN;

var urlBase = 'https://data.seattle.gov/resource/';

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

var appHeaders = {
    'X-App-Token': appToken
};

var services = {
    crimes: {
        options: {
            url: urlBase + '3k2p-39jp.json?$where=event_clearance_date%20IS%20NOT%20NULL&$order=event_clearance_date%20DESC&$limit=25',
            headers: appHeaders
        },
        POLL_INTERVAL: 10 * 60 * 1000, // 10 mins
        isReady: false,
        clients: [],
        data: [],
        latest: []
    },

    fires: {
        options: {
            url: urlBase + 'kzjm-xkqj.json?$where=datetime%20IS%20NOT%20NULL&%24order=datetime%20desc&$limit=25',
            headers: appHeaders
        },
        POLL_INTERVAL: 30 * 1000, // 30 secs
        isReady: false,
        clients: [],
        data: [],
        latest: []
    }
};

var loadData = function(type) {
    var service = services[type];

    request(service.options, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var data = JSON.parse(body);
            service.isReady = true;
            logger.info(type + ': updated and ready');
            logger.info(type + ' updates set to refresh every ' + service.POLL_INTERVAL / 1000 / 60 + ' mins');

            if (type === 'crimes') {
                for (i in data) {
                    sanitizeCrimeEvent(data[i]);
                }
            }

            service.data = data;

            // start polling for new events
            setInterval(function() {
                if (services[type].isReady) {
                    fetchAndPush(type);
                }
            }, service.POLL_INTERVAL);
        } else {
            logger.error(err);
        }
    });
}

server.start = function(port, debug) {
    server.listen(port, function() {
        logger.info('Websocket server is listening on port ' + port);

        loadData('fires');
        loadData('crimes');
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

    connection.on('message', function(message) {
        if (message.type === 'utf8') {

            var message = message.utf8Data;
            logger.info('Received message: ' + message);

            if (message === 'debug') {
                printDebug();
            }

            if (message === 'crimes' || message === 'fires') {
                var type = message;
                connection.sendUTF(JSON.stringify({
                    service: type,
                    new: false,
                    data: services[type].data
                }));

                services[type].clients.push(connection);

                if (type === 'crimes') {
                    removeClient('fires', connection);
                } else {
                    removeClient('crimes', connection);
                }
            }
        }
    });

    connection.on('close', function(reasonCode, description) {
        logger.info('Peer ' + connection.remoteAddress + ' disconnected.');
        removeClient('fires', connection);
        removeClient('crimes', connection);
    });
});

var removeClient = function(type, connection) {
    var index = services[type].clients.indexOf(connection);
    if (index != -1) {
        services[type].clients.splice(index, 1);
    }
}

/*
 * HELPER FUNCTIONS
 */

// Fetch the latest 25 events.
// If new events are found (not within server.crimes), push
// new events to connected clients, and update server.crimes
var fetchAndPush = function(type) {

    var service = services[type];

    request(service.options, function (err, res, body) {
        if (!err && res.statusCode == 200) {
            var fetchedData = JSON.parse(body);

            logger.info('Refreshing ' + type + ' data... ' +  
                'Fetched ' + fetchedData.length + ' items.');

            var hasNew = false;
            var newCount = 0;
            var updates = [];

            for (i in fetchedData) {
                var newEntry = fetchedData[i];

                if (type === 'crimes') {
                    sanitizeCrimeEvent(newEntry);
                }

                var isNew = true;

                // check existing crimes for newCrime
                for (j in service.data) {
                    if (objEqual(service.data[j], newEntry)) {
                        isNew = false;
                   }
                }

                if (isNew) {
                    hasNew = true;
                    newCount++;
                    updates.push(newEntry);
                }
            }

            if (hasNew) {
                logger.info(newCount + ' new ' + type + ' found.');
                service.latest = updates;

                // remove the last (numNewCrimes) crimes from the array
                service.data.splice(service.data.length - newCount, newCount);

                // add the newest crimes in chronological order (newest first)
                for (i in updates) {
                    service.data.splice(i, 0, updates[i]);
                }

                // send to clients
                pushUpdates(type);
            }
        }
    });
};

var printDebug = function() {
    for (i in services) {
        var data = services[i].data;
        console.log(i);
        for (j in data) {
            var event = data[j];
            console.log(new Date(event.datetime * 1000));
        }
    }
}

var sanitizeCrimeEvent = function(crime) {
    crime['address'] = crime.hundred_block_location;
    crime['type'] = crime.event_clearance_description;
    crime['datetime'] = (Date.parse(crime.event_clearance_date) / 1000) + (8 * 3600);

    delete crime.hundred_block_location;
    delete crime.event_clearance_description;
    delete crime.event_clearance_date;
};

/**
 * Check for crime object equality
 *
 * @return true iff the non-object fields of crime1 and crime2 
 *         are equivalent (===)
 */
var objEqual = function(obj1, obj2) {
    var equal = true;
    for (key in obj1) {
        if (!obj2.hasOwnProperty(key) || (obj2[key] !== obj1[key] && typeof obj1[key] !== 'object')) {
            equal = false;
        }
    }
    return equal;
}

/**
 * Send the latest updates in JSON format, where 'latest' means new
 * crimes since the last refresh interval.
 */
var pushUpdates = function(type) {
    logger.info('Pushing new ' + type + ' to clients: ');
    for (i in services[type].clients) {
        var connection = services[type].clients[i];
        connection.sendUTF(JSON.stringify({
            service: type,
            new: true,
            data: services[type].latest
        }));
    }
    logger.info('Pushed updates to ' + services[type].clients.length + ' clients');
}

exports.server = server;

