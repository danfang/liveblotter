// @author: Daniel Fang
// @email: danfang@uw.edu

var url = "ws://code.danielfang.org/liveblotter/ws/";
var ws = new WebSocket(url);
var crimes = [];
var markers = [];
var map, mapOptions;
var now = new Date();

$(document).ready(function() {

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
    };

	ws.onclose = function(evt) {
        $("#status").html('status: <span class="disconnected">disconnected</span>');
    };

    ws.onerror = function(evt) {};

	ws.onmessage = function(evt) {
        var data = JSON.parse(evt.data);
        var html = "";

        if (data.hasOwnProperty("existing")) {
            for (i in data.existing) {
                var crime = data.existing[i];
                crimes.push(crime);
                dropMarker(i);
                var date = new Date(crime.event_clearance_date);
                date.setHours(date.getHours() + 8);
                var ago = (now - date) / (1000 * 60);
                var agoString;
                if (ago > 60) {
                    agoString = '<div class="date">' + parseInt(ago / 60) + ' hours ago' + 
                        '</div>';
                } else {
                    agoString = parseInt(ago) + ' minutes ago';
                }

                html += '<div class="update hvr-underline-from-left">' + agoString + '<p>' + 
                    crime.event_clearance_description + '</p></div>';
            }
            $("#feed").html(html);
        } else if (data.hasOwnProperty("new")) {
            var numNewCrimes = data.new.length;
            crimes.splice(crimes.length - numNewCrimes, numNewCrimes);
            var toDrop = markers.splice(crimes.length - numNewCrimes, numNewCrimes);

            for (i in toDrop) {
                markers[i].setMap(null);
            }

            for (i in data.new) {
                var crime = data.new[i];
                crimes.splice(i, 0, crime);

                dropMarker(i);

                var date = Date.parse(crime.event_clearance_date);
                var ago = now - date;

                html += '<p>' + ago + 'ago:  ' + 
                    crime.event_clearance_description + '</p>';
                $("#feed").last().remove();
            }

            $("#feed").html(html + $("#feed").html()); 
        }
        updateClickEvents();
    };
});

function updateClickEvents() {
    $(".update").click(function(){
        var index = $(".update").index(this);
        google.maps.event.trigger(markers[index], 'click');
    });

   $(".update").hover(function(){
        var index = $(".update").index(this);
        markers[index].setAnimation(google.maps.Animation.BOUNCE);
    }, function() {
        var index = $(".update").index(this);
        markers[index].setAnimation(null);
    });
}

function resizeContent(height) {
    $("#content-container").css("height", height);
}

function dropMarker(i) {
    setTimeout(function() {
        createMarker(crimes[i]);
    }, i * 75);
}

var info = null;

function createMarker(crime) {
    var marker = new google.maps.Marker({
        map:map,
           draggable:false,
           animation: google.maps.Animation.DROP,
           position: new google.maps.LatLng(
               crime.latitude,
               crime.longitude
           )
    });

    markers.push(marker);

    var contentString = '<div class="marker-content">' +
        '<h1>' + crime.event_clearance_description + '</h1>' +
        '<h2>Located at: ' + crime.hundred_block_location + '</h2/>' +
        '<h2>Occurred at: ' + new Date(crime.event_clearance_date) + '</h2>' +
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
}
