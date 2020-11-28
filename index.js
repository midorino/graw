// Strict mode
function strict() {
	'use strict';

    //-- Define radius function
    if (typeof (Number.prototype.toRad) === "undefined") {
        Number.prototype.toRad = function () {
            return this * Math.PI / 180;
        }
    }

    //-- Define degrees function
    if (typeof (Number.prototype.toDeg) === "undefined") {
        Number.prototype.toDeg = function () {
            return this * (180 / Math.PI);
        }
    }

    // Define middle point function
    function middlePoint(lat1, lng1, lat2, lng2) {
        // Longitude difference
        let dLng = (lng2 - lng1).toRad();

        // Convert to radians
        lat1 = lat1.toRad();
        lat2 = lat2.toRad();
        lng1 = lng1.toRad();

        let bX = Math.cos(lat2) * Math.cos(dLng);
        let bY = Math.cos(lat2) * Math.sin(dLng);
        let lat3 = Math.atan2(Math.sin(lat1) + Math.sin(lat2), Math.sqrt((Math.cos(lat1) + bX) * (Math.cos(lat1) + bX) + bY * bY));
        let lng3 = lng1 + Math.atan2(bY, Math.cos(lat1) + bX);

        return [lat3.toDeg(), lng3.toDeg()];
    }


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

	async function loadCsvFile(csvFilePath) {
	    // Mocking
        return new Promise(resolve => {
            setTimeout(() => {
                // Load file content into 'result'
                let result = "";
                resolve(result);
            }, 1000);
        });
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

            // Link between loaded region track and corresponding runner? (via 'runners.region')
            let progressRate = runner.progress; // Will be calculated from steps of Garmin challenge (in CSV format) actually
        	let progressDistance = progressRate * gpxRoute.distance.total;

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

    // TODO To be loaded from Garmin CSV data
    var runners = [
        {
            id: 1,
            region: 1,
            progress: Math.random()
        },
        {
            id: 2,
            region: 2,
            progress: Math.random()
        },
        {
            id: 3,
            region: 3,
            progress: Math.random()
        },
        {
            id: 4,
            region: 4,
            progress: Math.random()
        },
        {
            id: 5,
            region: 5,
            progress: Math.random()
        },
        {
            id: 6,
            region: 6,
            progress: Math.random()
        },
        {
            id: 7,
            region: 7,
            progress: Math.random()
        },
        {
            id: 8,
            region: 8,
            progress: Math.random()
        },
        {
            id: 9,
            region: 9,
            progress: Math.random()
        },
        {
            id: 10,
            region: 10,
            progress: Math.random()
        },
        {
            id: 11,
            region: 11,
            progress: Math.random()
        },
        {
            id: 12,
            region: 12,
            progress: Math.random()
        }
    ];

    // CSV data (progress routes)
    // loadCsvFile();

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

    var globalRoutes = {};

	for(let runner of runners) {
	    loadGpxFile(runner, gpxFiles[runner.region - 1]); // Beware: index != length
    }
}
strict();