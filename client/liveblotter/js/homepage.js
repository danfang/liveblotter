// @author: Daniel Fang
// @email: danfang@uw.edu

var url = "ws://code.danielfang.org/liveblotter/ws/";
var ws = new WebSocket(url);
var crimes = [];

$(document).ready(function() {

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
                html += "<p>" + crime.event_clearance_date + ':  ' + crime.event_clearance_description + "</p>";
            }
            $("#feed").html(html);
        } else if (data.hasOwnProperty("new")) {
            var numNewCrimes = data.new.length;
            crimes.splice(crimes.length - numNewCrimes, numNewCrimes);

            for (i in data.new) {
                var crime = data.new[i];
                crimes.splice(i, 0, crime);
                html += "<p>" + crime.event_clearance_date + ':  ' + 
                    crime.event_clearance_description + "</p>";
            }

            $("#feed").html(html + $("#feed").html()); 
        }
    };


});


function initialize() {
	var mapOptions = {
		center: { lat: 47.6063889, lng: -122.3308333},
		zoom: 8
	};
	var map = new google.maps.Map(document.getElementById('map'),
		mapOptions);
}
