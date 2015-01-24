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
        switchService();
    });

    $("#crimes").click(function() {
        $("#crimes").prop("disabled", true);
        $("#fires").prop("disabled", false);
        switchService();
    });
    var titleHeight = $("#title-bar").height();

    resizeContent($(window).height() - titleHeight);

    $(window).resize(function() {
        resizeContent($(window).height() - titleHeight);
    });

    setInterval(function() {
        now = new Date();
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
    var date = new Date(dateString);
    var ago = (now - date) / (1000 * 60);
    var agoString = '<div class="date">';
    var time;
    if (ago > 60) {
        time = parseInt(ago / 60);
        agoString += parseInt(ago / 60) + ' hour';
    } else {
        time = parseInt(ago);
        agoString += parseInt(ago) + ' minute';
    }
    agoString += time == 1 ? ' ago': 's ago';
    agoString += '</div>';
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
    var html = "";

    if (!isNew) {
        service.data = [];

        for (i in data) {
            var event = data[i];
            service.data.push(event);
            dropMarker(type, event);

            var dateDiv = getDateDiv(event.datetime * 1000);
            html += '<div class="update hvr-underline-from-left">' + dateDiv + '<p>' + 
                event.type + '</p></div>';
        }
        $("#feed").html(html);
    } else {
        var newCount = data.length;
        service.data.splice(service.data.length - newCount, newCount);
        var toDrop = service.markers.splice(service.data.length - newCount, newCount);

        for (i in toDrop) {
            service.markers[i].setMap(null);
        }

        for (i in data) {
            var event = data[i];
            service.splice(i, 0, event);

            dropMarker(type, event);
            var dateDiv = getDateDiv(event.datetime);

            html += '<div class="update hvr-underline-from-left">' + dateDiv + '<p>' + 
                event.type + '</p></div>';

            $("#feed").last().remove();
        }
        $("#feed").html(html + $("#feed").html()); 
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

function dropMarker(type, event) {
    setTimeout(function() {
        createMarker(type, event);
    }, i * 75);
}

var info = null;

function createMarker(type, event) {
    var marker = new google.maps.Marker({
        map:map,
           draggable:false,
           animation: google.maps.Animation.DROP,
           position: new google.maps.LatLng(
               event.latitude,
               event.longitude
           )
    });
    services[type].markers.push(marker);

    var contentString = '<div class="marker-content">' +
        '<h1>' + event.type + '</h1>' +
        '<h2>Located at: ' + event.address + '</h2/>' +
        '<h2>Occurred at: ' + new Date(event.datetime * 1000) + '</h2>' +
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
