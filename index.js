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
        let jsonTxt = await loadFile(jsonFilePath);
        let data = JSON.parse(jsonTxt);

        let lastUpdateIndex = 0;

        data.forEach(function (d, i) {
            let datetimestr = d.datetime;
            let datetime = new Date(datetimestr + "Z");

            if(datetime > lastUpdate) {
                lastUpdate = datetime;
                lastUpdateIndex = i;
            }
        });

        let runners = data[lastUpdateIndex].data;

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

            // OK but that's progress distance regarding true CRAW region total distance (not GPX drawing distance)...
            let crawTotalDistance = regions[runner.region - 1] * 1000;
            let progressRate = progressDistance / crawTotalDistance;
            progressDistance = progressRate * gpxRoute.distance.total;

            console.debug("[R-%i] Steps: %d m", runner.id, runner.steps);
            console.debug("[R-%i] CRAW total distance: %d m", runner.id, crawTotalDistance);
            console.debug("[R-%i] Progress rate: %d %", runner.id, progressRate * 100);
            console.debug("[R-%i] Drawing progress distance: %d m", runner.id, progressDistance);

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

            let remainingDistance = progressDistance - distanceCumul; // From last covered waypoint

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
    			icon: myIcon,
    			title: "Region "+runner.id+"\n"+gpxRoute.name
    		})
    		.bindTooltip("R"+runner.id, {permanent: true, direction: 'bottom'})
    		.addTo(mymap)
    		.bindPopup("<b>Region "+runner.id+" - "+gpxRoute.name+"</b><br>"
    		+"Distance à parcourir : "+crawTotalDistance/1000+" km<br>"
    		+"Distance parcourue : "+runner.steps/1000+" km ("+(progressRate*100).toFixed(2)+"%)<br>"
    		+"Dernière MàJ : "+lastUpdate.toLocaleString())
    		;
    	});

        lGpx.addTo(mymap);
	}

    /** Init Leaflet world map **/

	var mymap = L.map('mapid', {
	    zoomSnap: 0.25,
	    worldCopyJump: true
	}).setView([0, 0], 1.75);

	L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' + '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
		id: 'mapbox/streets-v11',
		tileSize: 512,
		zoomOffset: -1,
		accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
	}).addTo(mymap);

    /** Load data **/

    const runnersJsonFile = 'data/graw.json';

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

    // True CRAW regions data (especially distances)
    const regions = [
        4009,
        4948,
        5106,
        5305,
        4246,
        3360,
        3201,
        2673,
        3731,
        4338,
        4321,
        3311
    ]

    var lastUpdate = new Date(0);
    var globalRoutes = {};

    loadJsonFile(runnersJsonFile);
}
strict();