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
    		} else {
    		    // TODO Handle error
    		}
    		resolve(result);
	    });
	}

	async function loadJsonFile(jsonFilePath) {
        var jsonTxt = await loadFile(jsonFilePath);
        runners = JSON.parse(jsonTxt);

        for(let runner of runners) {
    	    loadGpxFile(runner, gpxFiles[runner.region - 1]); // Beware: index != length
        }
	}

	async function loadGpxFile(runner, gpxFilePath) {
        var gpxTxt = await loadFile(gpxFilePath);

        /** Parse GPX data **/

	    var gpxData = new gpxParser();
    	gpxData.parse(gpxTxt);
    	var gpxRoute = gpxData.routes[0];

        console.log("[GPXParser] <" + gpxRoute.name + "> Total distance: " + gpxRoute.distance.total + " m");

    	/** ---------- **/

        /** Draw complete track **/

    	let lGpx = new L.GPX(gpxFilePath, {
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

            /** Build progress GPX data from complete GPX track **/

            let progressDistance = runner.steps / 1000 * 1000; // Just to remind that 1 step ~ 1 m but also all calculus below are in meters (not km).
            if(progressDistance > gpxRoute.distance.total) { progressDistance = gpxRoute.distance.total; }

    		let latLngs = e.target.getLayers()[0].getLayers()[0].getLatLngs();

            let distanceCumul = 0;
            let f = 0; // Index of closer waypoint latLng
            for(let i = 0; i < latLngs.length; i++) {
                let distance = latLngs[i].distanceTo(latLngs[i+1]);

            	if(distanceCumul + distance >= progressDistance) { // Progress overcome last waypoint
            	    f = i;
            	    break;
            	} else {
            	    distanceCumul += distance;
            	}
            }

            console.debug("Last overcome waypoints: %d/%d %o", f, latLngs.length, latLngs[f]);

            let remainingDistance = progressDistance - distanceCumul; // From last covered waypoint
            console.debug("Progress distance from last waypoint: %f m", remainingDistance);

            // Remove not covered points
        	// Surely a cleaner way to do this...
        	// Must be done on 'gpxData' object to be able to export to GeoJSON after
        	gpxData.routes[0].points.length = f + 1; // True last overcome waypoint is [f] ; [f+1] is going to be update with middle point

        	// TODO Add intermediate progress point (to be calculated from remaining distance)

            console.debug("gpx.Route.points: %o", gpxData.routes[0].points);

        	// Export trimmed progress data to GeoJSON
        	// Easiest way for now to draw the progress track
        	let geojson = gpxData.toGeoJSON();

        	/** ---------- **/

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

    	});

        lGpx.addTo(mymap);
	}

    /** Init Leaflet world map **/

	var mymap = L.map('mapid').setView([0, 0], 1.4);

	L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' + '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
		id: 'mapbox/streets-v11',
		tileSize: 512,
		zoomOffset: -1,
		accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
	}).addTo(mymap);

    /** Load data **/

    // TODO To be loaded from Garmin data (JSON or CSV)
    const runnersJsonFile = 'data/graw/20201130.json';

    // GPX data (complete routes)
    // Must be ordered by region number (link with runners[*].region)
    const gpxFiles = [
        'data/craw/region-1-latin-america.gpx',
        'data/craw/region-2-andes.gpx',
        'data/craw/region-3-pampas.gpx',
        'data/craw/region-4-antarctica.gpx',
        'data/craw/region-5-down-under.gpx',
        'data/craw/region-6-the-islands.gpx',
        'data/craw/region-7-malay-peninsula.gpx',
        'data/craw/region-8-indian-subcontinent.gpx',
        'data/craw/region-9-the-stans.gpx',
        'data/craw/region-10-europe.gpx',
        'data/craw/region-11-great-white-north.gpx',
        'data/craw/region-12-lower-48.gpx'
    ];

    var runners = {};
    var globalRoutes = {};

    loadJsonFile(runnersJsonFile);
}
strict();