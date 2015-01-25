// @author: Daniel Fang
// @email: danfang@uw.edu

var url = "ws://code.danielfang.org/liveblotter/ws/";
var ws = new WebSocket(url);

var services = {
    crimes: {
        data: [],
        markers: [],
        subscribed: true
    },

    fires: {
        data:[], 
        markers: [],
        subscribed: false
    }
}

var map, mapOptions;
var now = new Date();

$(document).ready(function() {

    $("#fires").click(function() {
        $("#fires").prop("disabled", true);
        $("#crimes").prop("disabled", false);
        $("#mode").html("FIRE 911 RESPONSE");
        switchService();
    });

    $("#crimes").click(function() {
        $("#crimes").prop("disabled", true);
        $("#fires").prop("disabled", false);
        $("#mode").html("POLICE 911 RESPONSE");
        switchService();
    });
    var titleHeight = $("#title-bar").height();

    resizeContent($(window).height() - titleHeight);

    $(window).resize(function() {
        resizeContent($(window).height() - titleHeight);
    });

    setInterval(function() {
        now = new Date();
        refreshHTML();
    }, 1000);

    // Google Maps init
	initialize();

    // Websocket handlers
	ws.onopen = function(evt) {
        $("#status").html('status: <span class="connected">connected</span>');
        ws.send("crimes");
    };

	ws.onclose = function(evt) {
        $("#status").html('status: <span class="disconnected">disconnected</span>');
    };

    ws.onerror = function(evt) {};

    // Pre: data will be valid JSON and have the following fields:
    // 'service': string,
    // 'new': boolean,
    // 'data': obj
	ws.onmessage = function(evt) {
        var response = JSON.parse(evt.data);
        var html = "";

        updateService(response.service, response.new, response.data);
        updateClickEvents(response.service);
    };
});

function getDateDiv(dateString) {
    var date = new Date(dateString * 1000);
    var ago = (now - date) / (1000 * 60);
    var agoString = '';
    if (ago > 60) {
        var hours = parseInt(ago / 60);
        agoString += hours + 'h ';
        var minutes = parseInt(ago % 60);
        agoString += minutes + 'm ';
    } else {
        var minutes = parseInt(ago);
        agoString += minutes + 'm ';
    }
    agoString += 'ago';
    return agoString;
}

function clearMarkers(type) {
    var markers = services[type].markers;
    for (i in markers) {
        markers[i].setMap(null);
    }
}

function switchService() {
    if (services.crimes.subscribed) {
        ws.send("fires");
        clearMarkers("crimes");
        services.crimes.markers = [];
    } else {
        clearMarkers("fires");
        ws.send("crimes");
        services.fires.markers = [];
    }
    services.crimes.subscribed = !services.crimes.subscribed;
    services.fires.subscribed = !services.fires.subscribed;
}

function updateService(type, isNew, data) {
    var service = services[type];

    if (!isNew) {
        service.data = [];

        var html = "";

        for (i in data) {
            var event = data[i];
            service.data.push(event);
            dropMarker(type, event, i, false);

            var dateDiv = getDateDiv(event.datetime);
            html += '<div class="update hvr-underline-from-left">' +
               '<div class="date">' + dateDiv + '</div><p>' + 
                event.type + '</p></div>';
        }

        $("#feed").html(html);
    } else {
        var newCount = data.length;
        service.data.splice(service.data.length - newCount, newCount);
        var toDrop = service.markers.splice(service.data.length - newCount, newCount);

        for (i in toDrop) {
            toDrop[i].setMap(null);
        }

        for (var i = data.length - 1; i >= 0; i--) {
            var event = data[i];
            service.data.splice(0, 0, event);

            dropMarker(type, event, 0, true);
            var dateDiv = getDateDiv(event.datetime);

            var html = '<div class="update hvr-underline-from-left"><div class="date">' + dateDiv + '</div><p>' + 
                event.type + '</p></div>';

            $(".update").last().remove();
            $("#feed").prepend(html); 
        }
    }
}

function refreshHTML() {
    for (i in services) {
        if (services[i].subscribed) {
            $(".update .date").each(function(index) {
                var event = services[i].data[index];
                var dateDiv = getDateDiv(event.datetime);
                $(this).html(dateDiv);
            });
        }
    }
}

function updateClickEvents(type) {
    $(".update").click(function(){
        var index = $(".update").index(this);
        google.maps.event.trigger(services[type].markers[index], 'click');
    });

   $(".update").hover(function(){
        var index = $(".update").index(this);
        services[type].markers[index].setAnimation(google.maps.Animation.BOUNCE);
    }, function() {
        var index = $(".update").index(this);
        services[type].markers[index].setAnimation(null);
    });
}

function resizeContent(height) {
    $("#content-container").css("height", height);
}

function dropMarker(type, event, index, isNew) {
    setTimeout(function() {
        createMarker(type, event, isNew);
    }, index * 75);
}

var info = null;

function createMarker(type, event, isNew) {
    var marker = new google.maps.Marker({
        map:map,
           draggable:false,
           animation: google.maps.Animation.DROP,
           position: new google.maps.LatLng(
               event.latitude,
               event.longitude
           )
    });

    if (isNew) {
        console.log('Adding marker to beginning');
        services[type].markers.splice(0, 0, marker);
    } else {
        services[type].markers.push(marker);
    }
    var date = new Date(event.datetime * 1000);
    date = date.toLocaleString();

    var contentString = '<div class="marker-content">' +
        '<h1>' + event.type + '</h1>' +
        '<h2>@ ' + event.address + '</h2/>' +
        '<h2>' + date + '</h2>' +
        '</div>'; 

    google.maps.event.addListener(marker, 'click', function() {
        if (info) {
            info.close();
        }
        info = new google.maps.InfoWindow({
            content: contentString
        });
        info.open(map, marker);
    });
}

function initialize() {
	mapOptions = {
		center: { lat: 47.6063889, lng: -122.3308333},
		zoom: 11
	};
	map = new google.maps.Map(document.getElementById('map'),
		mapOptions);

    google.maps.event.addListener(map, 'click', function() {
        if (info) {
            info.close();
        }
    });
}
