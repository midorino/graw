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
        return data;
	}

	async function displayRegion(region) {
	    let gpxFilePath = "data/" + region.gpxFile;
        var gpxTxt = await loadFile(gpxFilePath);

        /** Parse GPX data **/

	    var gpxData = new gpxParser();
    	gpxData.parse(gpxTxt);

    	// For now, only way to get data without risk to get undefined values for all the async calls...
    	regions[region.id - 1].gpxData = gpxData;

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
    	    // Must only be used for display actions (not logic) for this 'loaded' event and the logic async calls are not linked
    	}).addTo(mymap);

    	return lGpx;
    }

	async function displayRecord(datetime, data) {
	    //var gpxRoute = gpxData.routes[0];
        //regions[region.id-1].points = gpxRoute.points;
    	//regions[region.id-1].distanceDisplayedTotal = gpxRoute.distance.total;

        let record = data;
        let participant = participants[record.id - 1]; // !!! ID != Index !!!
        let region = regions[participant.region - 1]; // !!! ID != Index !!!
        let gpxData = region.gpxData.routes[0];

        // Record distance is relative to total actual CRAW distance (!= displayed distance)!
        // There is 2 dimensions to consider: Actual/Displayed x Record/Total.

        let distanceActualTotal = region.distanceTrue;
        let distanceActualRecord = record.distance;

        // Link between "actual" and "displayed" data
        let rate = distanceActualRecord / distanceActualTotal;

        let distanceDisplayedTotal = gpxData.distance.total;
        let distanceDisplayedRecord = rate * distanceDisplayedTotal;

        console.debug("+ Actual distances:\n- Total: %f m\n- Record: %f m", distanceActualTotal, distanceActualRecord);
        console.debug("+ Rate: %f %", rate * 100);
        console.debug("+ Displayed distances:\n- Total: %f m\n- Record: %f m", distanceDisplayedTotal, distanceDisplayedRecord);

        if(distanceDisplayedRecord > distanceDisplayedTotal) { distanceDisplayedRecord = distanceDisplayedTotal; }

        // Get "record" waypoint

        // Create a Leaflet LatLng array (in order to use 'distanceTo()')
        let points = gpxData.points;
        let latLngs = [];
        points.forEach(function (point, i) {
            let latLng = L.latLng(point.lat, point.lon);
            latLngs.push(latLng);
        });

        // Calculate closer last waypoint
        let distanceCumul = 0;
        let f = 0; // Index of closer waypoint
        for(let i = 0; i < latLngs.length; i++) {
            let distance = latLngs[i].distanceTo(latLngs[i+1]);

        	if(distanceCumul + distance >= distanceDisplayedRecord) { // Progress overcome last waypoint
        	    f = i;
        	    break;
        	} else {
        	    distanceCumul += distance;
        	}
        }

        let distanceRemaining = distanceDisplayedRecord - distanceCumul; // From last covered waypoint
        console.debug("Distance Remaining (since last waypoint %d): %f m", f, distanceRemaining);

        // Remove not covered points
    	// Surely a cleaner way to do this...
    	// Must be done on 'gpxData' object to be able to export to GeoJSON after
    	let gpx = region.gpxData;
    	gpx.routes[0].points.length = f + 1; // True last overcome waypoint is [f] ; [f+1] is going to be update with middle point

    	// TODO Add intermediate progress point (to be calculated from remaining distance)

    	// Export trimmed progress data to GeoJSON
    	// Easiest way for now to draw the progress track
    	let geojson = gpx.toGeoJSON();

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

        // Optimal data
        let diffTimeSinceStart = Math.abs(new Date(datetime).getTime() - new Date("2020-11-01").getTime());  // Here is considered the last update as a reference point (and not "today") - also, challenge started on 2020-11-01.
        let diffDaysSinceStart = Math.ceil(diffTimeSinceStart / (1000 * 3600 * 24));
        let distanceActualOptimal = distanceActualTotal / 365 * diffDaysSinceStart;
        let rateOptimal = distanceActualOptimal / distanceActualTotal;

		// Add marker at current progress position
		let lastPosition = gpx.routes[0].points.length - 1;

		let myIcon = L.icon({
			iconUrl: 'img/pin-icon-runner.png',
			iconSize: [35, 35]
		});

		L.marker(latLngs[lastPosition], {
			icon: myIcon,
			title: "Region "+participant.id+"\n"+region.title
		})
		.bindTooltip("R"+participant.id, {permanent: true, direction: 'bottom'})
		.addTo(mymap)
		.bindPopup("<b>Region " + participant.id + " - " + region.title + "</b><br>"
		+"Distance à parcourir : " + (distanceActualTotal/1000).toFixed(2) + " km<br>"
		+"Distance parcourue : " + (distanceActualRecord/1000).toFixed(2) + " km (" + (rate*100).toFixed(2) + "%)<br>"
		+"Distance optimale (" + diffDaysSinceStart + "J) : " + (distanceActualOptimal/1000).toFixed(2) + " km (" + (rateOptimal*100).toFixed(2) + "%)<br>"
		+"Dernière MàJ : " + datetime.toLocaleString())
		;
	}

    /**--------------**/
    /** MAIN PROGRAM **/
    /**--------------**/

    /** Init world map **/

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

    // Data files

    const dataFolder = 'data';
    const participantsJsonFile = dataFolder + '/' + 'participants.json';
    const regionsJsonFile = dataFolder + '/' +'regions.json';
    const recordsJsonFile = dataFolder + '/' +'records.json';

    // Data variables

    var participants = [];
    var regions = [];
    var records = [];

    // Logic variables

    var loadingRegions, loadingParticipants, displayingRegions, loadingRecords;

    // 1.a. Load regions data
    loadingRegions = loadJsonFile(regionsJsonFile).then( function(data) {
        regions = data;
        console.debug("Loaded regions JSON data: %o", regions);
    });

    // 1.b. Load participants data
    loadingParticipants = loadJsonFile(participantsJsonFile).then( function(data) {
        participants = data;
        console.debug("Loaded participants JSON data: %o", participants);
    });

    // Wait for previous operations (1.*)
    // await Promise.all([loadingRegions, loadingParticipants]);
    Promise.all([loadingRegions, loadingParticipants]).then(([a, b]) => {
        // 2.a. Display regions view
        displayingRegions = []
        for(let region of regions) {
    	    let displayingRegion = displayRegion(region).then( function() {
    	        console.debug("Displayed and updated region data: %o", region);
    	    });
    	    displayingRegions.push(displayingRegion);
        }

        // 2.b. Load records data
        loadingRecords = loadJsonFile(recordsJsonFile).then( function(data) {
            records = data;
            console.debug("Loaded records JSON data: %o", records);
        });

        // Wait for previous operations (2.*)
        Promise.all([displayingRegions, loadingRecords]).then(([a, b]) => {
            // 3. Display *last* record view
            let lastUpdate = new Date(0);
            let lastUpdateIndex = 0;

            records.forEach(function (record, i) {
                let datetimestr = record.datetime;
                let datetime = new Date(datetimestr + "Z");

                if(datetime > lastUpdate) {
                    lastUpdate = datetime;
                    lastUpdateIndex = i;
                }
            });

            let lastRecord = records[lastUpdateIndex];
            console.debug("Most recent record: %o", lastRecord);

        	lastRecord.data.forEach(function (d, i) {
        	    displayRecord(lastRecord.datetime, d);
        	});
        });
    });
}
strict();