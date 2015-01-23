var url = "ws://54.148.197.68:8080/";
var ws = new WebSocket(url);
var crimes = {};

$(document).ready(function() {

	initialize();

	ws.onopen = function(evt) {
	};

	ws.onclose = function(evt) {
	};

	ws.onmessage = function(evt) {
		$("#feed").html("");

		var data = JSON.parse(evt.data);

		var html = "";
		for (i in data) {
			html += "<p>" + data[i].event_clearance_date + ':  ' + data[i].event_clearance_description + "</p>";
		}
		$("#feed").html(html);
	};

	ws.onerror = function(evt) {
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