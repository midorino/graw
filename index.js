// Strict mode
function strict() {
	'use strict';

	function loadFile(filePath) {
	    return new Promise(resolve => {
	        var result = null;
	        var xmlhttp = new XMLHttpRequest();
    		xmlhttp.open("GET", filePath, false);
    		xmlhttp.send();
    		if(xmlhttp.status === 200) {
    			result = xmlhttp.responseText;
    		}
    		resolve(result);
	    });
	}

	async function loadGpxFile(gpxFilePath) {
        let gpxTxt = await loadFile(gpxFilePath);

        /** Parse GPX data **/

	    let gpxData = new gpxParser();
    	gpxData.parse(gpxTxt);
    	let gpxRoute = gpxData.routes[0];

        console.log("[GPXParser] Name: " + gpxData.name);
    	console.log("[GPXParser] Total distance: " + gpxRoute.distance.total + " m");
    	console.log("[GPXParser] Route (below):");
    	console.log(gpxRoute);

    	/** ---------- **/

    	/** Build progress GPX track from complete GPX track **/

    	let progressDistance = 200000; // Will be loaded from CSV data actually

    	let cumulDistances = gpxRoute.distance.cumul;

    	let i, f;
    	for(i = 0; i < cumulDistances.length; i += i + 1) {
    		if(cumulDistances[i] > progressDistance) {
    			f = i;
    			break;
    		}
    	}

    	// Remove not covered points
    	// Surely a cleaner way to do this...
    	// Must be done on 'gpxData' object to be able to export to GeoJSON after
    	gpxData.routes[0].points.length = f + 2;

    	// Export trimmed progress data to GeoJSON
    	// Easiest way for now to draw the progress track
    	let geojson = gpxData.toGeoJSON();

    	/** ---------- **/

        /** Draw complete track **/

    	new L.GPX(gpxFilePath, {
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
    	/** ---------- **/
    	}).on('loaded', function(e) {
    	    /** Draw progress track **/
    	    // Only after complete track drawing complete

    		let gpxData = e.target;

    		// Just for the sake of comparison with GPXParser
    		console.log("[LeafletGPX] Total distance: " + gpxData.get_distance() + " m");

    		new L.geoJSON(geojson, {
    			pointToLayer: function(geoJsonPoint, latlng) {
    				// No waypoint drawing
    				return null;
    				// return L.marker(latlng, {icon: ...});
    			},
    			style: {
    				color: 'blue',
    				opacity: 1.0,
    				weight: 5,
    				lineCap: 'round'
    			}
    		}).addTo(mymap);

    		// Add marker at current progress position
    		let lastPosition = gpxRoute.points.length - 1;

    		let myIcon = L.icon({
    			iconUrl: 'img/pin-icon-runner.png',
    			iconSize: [35, 35]
    		});

    		L.marker(gpxRoute.points[lastPosition], {
    			icon: myIcon
    		}).addTo(mymap);

    	}).addTo(mymap);
	}

    // TODO Loop through all the GPX (and CSV) files
	var gpxFile = "data/craw/region-1-latin-america.gpx";
	loadGpxFile(gpxFile);

    // Initial world map
	var mymap = L.map('mapid').setView([0, 0], 1.4);

	L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' + '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
		id: 'mapbox/streets-v11',
		tileSize: 512,
		zoomOffset: -1,
		accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
	}).addTo(mymap);
}
strict();