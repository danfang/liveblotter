// @author: Daniel Fang
// @email: danfang@uw.edu

var url = "ws://code.danielfang.org/liveblotter/ws/";
var ws = new WebSocket(url);
var crimes = [];
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
	ws.onopen = function(evt) {};
	ws.onclose = function(evt) { };
    ws.onerror = function(evt) {};

	ws.onmessage = function(evt) {
        var data = JSON.parse(evt.data);
        var html = "";

        if (data.hasOwnProperty("existing")) {
            for (i in data.existing) {
                var crime = data.existing[i];
                crimes.push(crime);

                var date = new Date(crime.event_clearance_date);
                date.setHours(date.getHours() + 8);
                var ago = (now - date) / (1000 * 60);
                var agoString;
                if (ago > 60) {
                    agoString = "<div class=\"date\">" + parseInt(ago / 60) + " hours ago" + 
                        "</div>";
                } else {
                    agoString = parseInt(ago) + " minutes ago";
                }

                html += "<div>" + agoString + "<p>" + 
                    crime.event_clearance_description + "</p></div>";
            }
            $("#feed").html(html);
        } else if (data.hasOwnProperty("new")) {
            var numNewCrimes = data.new.length;
            crimes.splice(crimes.length - numNewCrimes, numNewCrimes);

            for (i in data.new) {
                var crime = data.new[i];
                crimes.splice(i, 0, crime);

                var date = Date.parse(crime.event_clearance_date);
                var ago = now - date;

                html += "<p>" + ago + 'ago:  ' + 
                    crime.event_clearance_description + "</p>";
                $("#feed").last().remove();
            }

            $("#feed").html(html + $("#feed").html()); 
        }
    };
});

function resizeContent(height) {
    $("#content-container").css("height", height);
}

function initialize() {
	var mapOptions = {
		center: { lat: 47.6063889, lng: -122.3308333},
		zoom: 12
	};
	var map = new google.maps.Map(document.getElementById('map'),
		mapOptions);
}
