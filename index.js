// Strict mode
function strict() {
	'use strict';

	function loadFile(filePath) {
		var result = null;
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.open("GET", filePath, false);
		xmlhttp.send();
		if(xmlhttp.status === 200) {
			result = xmlhttp.responseText;
		}
		return result;
	}
	var gpx1 = "data/craw/region-1-latin-america.gpx"; // URL to your GPX file or the GPX itself
	var mymap = L.map('mapid');
	L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' + '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
		id: 'mapbox/streets-v11',
		tileSize: 512,
		zoomOffset: -1,
		accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
	}).addTo(mymap);
	var gpxtxt = loadFile(gpx1);
	var gpx = new gpxParser(); //Create gpxParser Object
	gpx.parse(gpxtxt); //parse gpx file from string data
	var total_distance = gpx.routes[0].distance.total;
	console.log("[GPXParser] Total distance: " + total_distance + " m");
	// Build a progress GPX track from complete GPX track
	var progress_distance = 200000;
	var cumuls = gpx.routes[0].distance.cumul;
	console.log(gpx.routes[0]);
	/* Not the best way
	cumuls.forEach(checkProgress);

	function checkProgress(item, index) {}
	*/
	var i, f;
	for(i = 0; i < cumuls.length; i += i + 1) {
		if(cumuls[i] > progress_distance) {
			f = i;
			break;
		}
	}
	// Remove not covered data
	// Surely a cleaner way to do this...
	gpx.routes[0].points.length = f + 2;
	// GPXParser: export to GeoJSON
	var geojson = gpx.toGeoJSON();
	new L.GPX(gpx1, {
		async: true,
		gpx_options: {
			parseElements: ['route']
		},
		polyline_options: {
			color: 'red',
			opacity: 0.75,
			weight: 3,
			lineCap: 'square'
		},
		marker_options: {
			startIconUrl: 'img/pin-icon-start.png',
			endIconUrl: 'img/pin-icon-end.png',
			shadowUrl: 'img/pin-shadow.png',
			wptIconUrls: {
				// img/pin-icon-wpt.png
				// Useless if gpx_options / parseElements does not contain 'waypoints'
			}
		}
	}).on('loaded', function(e) {
		var gpx1data = e.target;
		// Just for the sake of comparison with GPXParser
		var track_distance = gpx1data.get_distance();
		console.log("[LeafletGPX] Total distance: " + track_distance + " m");
		mymap.fitBounds(e.target.getBounds());
		// Load progress data only after initial data load
		new L.geoJSON(geojson, {
			pointToLayer: function(geoJsonPoint, latlng) {
				//return L.marker(latlng, {icon: ...});
				return null;
			},
			style: {
				color: 'blue',
				opacity: 1.0,
				weight: 5,
				lineCap: 'round'
			}
		}).addTo(mymap);
		// Add marker at current progress position
		var last = gpx.routes[0].points.length - 1;
		var myIcon = L.icon({
			iconUrl: 'img/pin-icon-runner.png',
			iconSize: [35, 35]
		});
		L.marker(gpx.routes[0].points[last], {
			icon: myIcon
		}).addTo(mymap);
	}).addTo(mymap);
}
strict();