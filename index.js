// Strict mode
function strict() {
	'use strict';



	function loadFile(filePath) {
	    return new Promise(resolve => {
	        var result = null;
	        var xmlhttp = new XMLHttpRequest();
    		xmlhttp.open("GET", filePath, false); // 3rd parameter = synchronous
    		xmlhttp.overrideMimeType("text/plain");
    		xmlhttp.send(null);
    		if(xmlhttp.status === 200) {
    			result = xmlhttp.responseText;
    		} else {
    		    console.error("Error loading file '%s'", filePath);
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
	    let geojsonFilePath = dataFolder + '/' + region.geojsonFile; // @TODO Absolute path...?

	    loadJsonFile(geojsonFilePath).then( function(data) {
            let regionGeojson = data;

            regionGeojsons[region.id] = JSON.parse(JSON.stringify(regionGeojson));

            let regionStyle = {
                "weight": 10
            };

            let regionLayer = L.geoJSON(regionGeojson, {
                style: regionStyle
            });

            regionOverlays[region.id] = regionLayer;
            regionOverlays[region.id].addTo(mymap);
        });
	}



	async function displayPOI(region) {
	    let poiFilePath = dataFolder + '/' + region.poiFile; // @TODO Absolute path...?

	    loadJsonFile(poiFilePath).then( function(data) {
            var poiGeojson = data;

            var geojsonMarkerOptions = {
                icon: null,
                radius: 5,
                fillColor: "blue",
                color: "blue",
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            };

            var poiLayer = L.geoJSON(poiGeojson, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, geojsonMarkerOptions);
                }
            });

            poiOverlays[region.id] = poiLayer;
            poiOverlays[region.id].addTo(mymap);
        });
	}



    async function displayRecord(datetime, data) {
        let record = data;
        let participant = participants.filter((participant) => participant.id === record.id).shift();
        let region = regions[participant.region - 1]; // !!! ID != Index !!!

        let progressGeojson = JSON.parse(JSON.stringify(regionGeojsons[region.id])); // "Deep" copy - Seems functional - for coordinates copy at least

        // Record distance is relative to total actual CRAW distance (!= displayed distance)!
        // There is 2 dimensions to consider: Actual/Displayed x Record/Total.

        let distanceActualTotal = region.distanceTrue;
        let distanceActualRecord = record.distance;

        // Link between "actual" and "displayed" data
        let rate = distanceActualRecord / distanceActualTotal;

        // Calculate total displayed distance

        let distanceDisplayedTotal = 0;
        let coordinates = progressGeojson.features[0].geometry.coordinates;

        // (1) Create a L.latLng array for easy distance calculus with "distanceTo()"
        let latLngs = [];

        coordinates.forEach(function (coord, i) {
            let latLng = L.latLng(coord[1], coord[0]); // !!! GeoJSON != Leaflet for (lat, lng) variables order !!!
            latLngs.push(latLng);
        });

        // (2) Now actually calculate total distance
        for(let i = 0; i < latLngs.length-1; i++) {
            let distance = latLngs[i].distanceTo(latLngs[i+1]);
        	distanceDisplayedTotal += distance;
        }

        let distanceDisplayedRecord = rate * distanceDisplayedTotal;

        if(distanceDisplayedRecord > distanceDisplayedTotal) { distanceDisplayedRecord = distanceDisplayedTotal; }

        // Calculate closer last waypoint

        let distanceCumul = 0;
        let f = 0; // Index of closer waypoint

        for(let i = 0; i < latLngs.length-1; i++) {
            let distance = latLngs[i].distanceTo(latLngs[i+1]);

        	if(distanceCumul + distance >= distanceDisplayedRecord) { // Progress overcome last waypoint
        	    f = i;
        	    break;
        	} else {
        	    distanceCumul += distance;
        	}
        }

        let lastWaypointIndex = f;
        progressGeojson.features[0].geometry.coordinates.length = lastWaypointIndex + 1; // Probably not the cleanest way to do this

        let distanceRemaining = distanceDisplayedRecord - distanceCumul; // From last covered waypoint

        // Optimal data

        let diffTimeSinceStart = Math.abs(new Date(datetime).getTime() - new Date("2020-11-01").getTime());  // Here is considered the last update as a reference point (and not "today") - also, challenge started on 2020-11-01.
        let diffDaysSinceStart = Math.ceil(diffTimeSinceStart / (1000 * 3600 * 24));
        let distanceActualOptimal = distanceActualTotal / 365 * diffDaysSinceStart;
        let rateOptimal = distanceActualOptimal / distanceActualTotal;

        let msg = '*** Record from participant ' + participant.id + ' for region ' + region.id + ' from ' + participant.type + ' at ' + datetime.toLocaleString() + ' ***\n';
        msg += '+ Actual distances:\n';
        msg += '- Total: ' + distanceActualTotal + ' m\n';
        msg += '- Record: ' + distanceActualRecord + ' m\n';
        msg += '+ Displayed distances:\n';
        msg += '- Total: ' + distanceDisplayedTotal + ' m\n';
        msg += '- Record: ' + distanceDisplayedRecord + ' m\n';
        msg += '+ Rate: ' + rate * 100 + ' %\n';
        msg += '********************\n';
        msg += '+ Last waypoint: N°' + lastWaypointIndex + ' / ' + progressGeojson.features[0].geometry.coordinates[lastWaypointIndex] + '\n';
        msg += '+ Remaining distance (since last waypoint): ' + distanceRemaining + ' m\n';
        msg += '********************\n';
        msg += '+ Days since start: ' + diffDaysSinceStart + ' d\n';
        msg += '+ Optimal actual distance: ' + distanceActualOptimal + ' m\n';
        msg += '+ Optimal rate: ' + rateOptimal * 100 + ' %\n';
        msg += '************************************************************';
        console.debug(msg);

        /** Display **/

        let progressStyle = {
            "color": "orange",
            "weight": 5,
            "opacity": 0.9
        };

        let progressLayer = L.geoJSON(progressGeojson, {
            style: progressStyle
        }).addTo(mymap);

		// Add marker at current progress position with information

		let lastPosition = progressGeojson.features[0].geometry.coordinates.length - 1;

		let myIcon = L.icon({
			iconUrl: 'img/pin-icon-runner.png',
			iconSize: [35, 35]
		});

        let typeImgDiv = "";
        if(participant.type === "Garmin") {
            typeImgDiv = '<img style="vertical-align: middle;" src="img/logo-garmin-connect.png" alt="[Garmin]" title="Pour les participants Garmin (avec montre), tous les pas réalisés sont pris en compte." width="24" height="24"></img>';
        } else if (participant.type === "Strava") {
            typeImgDiv = '<img style="vertical-align: middle;" src="img/logo-strava.png" alt="[Strava]" title="Pour les participants Strava, seules les activités de course ou marche sont pris en compte." width="24" height="24"></img>';
        }

		L.marker(latLngs[lastPosition], {
			icon: myIcon,
			title: "Region "+participant.id+"\n"+region.title
		})
		.bindTooltip(""+participant.id+"", {permanent: true, direction: 'bottom'})
		.addTo(mymap)
		.bindPopup("<div>" + typeImgDiv + "<span style='vertical-align: middle;'><b> Participant " + participant.id + " - Region " + region.id + " (" + region.title + ")" + "</b></span></div>"
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

	var baseLayer = L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
		maxZoom: 18,
		attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' + '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' + 'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
		id: 'mapbox/streets-v11',
		tileSize: 512,
		zoomOffset: -1,
		accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
	}).addTo(mymap);

    /* TODO: Layers Leaflet organization
    var layers = {
        "Base": baseLayer
    };

    var regionOverlays = L.layerGroup();
    var poiOverlays = L.layerGroup();

    var overlays = {
        "Regions": regionOverlays,
        "Points Of Interest": poiOverlays
    };

    L.control.layers(layers, overlays).addTo(mymap);
    */

    var regionOverlays = [];
    var poiOverlays = [];
    var progressOverlays = [];
    var regionGeojsons = [];

    /** Load data **/

    // Data files

    const dataFolder = 'data'; // PROD: 'data' ; DEBUG: 'data/mock*'
    const participantsJsonFile = dataFolder + '/' + 'participants.json';
    const regionsJsonFile = dataFolder + '/' +'regions.json';
    const recordsJsonFile = dataFolder + '/' +'records.json';

    console.debug("Data folder: '%s'", dataFolder);
    console.debug("Data files: '%s'", [participantsJsonFile, regionsJsonFile, recordsJsonFile]);

    // Data variables

    var participants = [];
    var regions = [];
    var records = [];

    // Logic variables

    var loadingRegions, loadingParticipants, displayingRegions, loadingRecords; // Promises

    console.debug("[1.A] Loading regions data ('%s')...", regionsJsonFile);
    loadingRegions = loadJsonFile(regionsJsonFile).then( function(data) {
        regions = data;
        console.debug("[1.A] Loaded regions data: %o", regions);
    });

    console.debug("[1.B] Loading participants data ('%s')...", participantsJsonFile);
    loadingParticipants = loadJsonFile(participantsJsonFile).then( function(data) {
        participants = data;
        console.debug("[1.B] Loaded participants data: %o", participants);
    });

    console.debug("Waiting for previous operations [1.*]...");
    Promise.all([loadingRegions, loadingParticipants]).then(([a, b]) => {

        console.debug("[2.A] Displaying regions view...");
        displayingRegions = []
        for(let region of regions) {
            console.debug("[2.A.%d.a] Displaying region %d...", region.id, region.id);
    	    let displayingRegion = displayRegion(region).then( function() {
    	        console.debug("[2.A.%d.a] Displayed region %d", region.id, region.id);
    	    });

    	    displayingRegions.push(displayingRegion);

    	    console.debug("[2.A.%d.b] Displaying POI of region %d...", region.id, region.id);
    	    displayPOI(region).then( function() {
    	        console.debug("[2.A.%d.b] Displayed POI of region %d", region.id, region.id);
    	    });
        }

        console.debug("[2.B] Loading records data...");
        loadingRecords = loadJsonFile(recordsJsonFile).then( function(data) {
            records = data;
            console.debug("[2.B] Loaded records data: %o", records);
        });

        console.debug("Waiting for previous operations [2.*]...");
        Promise.all([displayingRegions, loadingRecords]).then(([a, b]) => {

            console.debug("[3.A] Finding last record...");
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

            console.debug("[3.A] Found last record: %o", lastRecord);

            console.debug("[3.B] Displaying last record...");

        	lastRecord.data.forEach(function (d, i) {
        	    console.debug("[3.B.%d] Displaying last record data %d...", i, i);
        	    displayRecord(lastRecord.datetime, d).then( function() {
        	        console.debug("[3.B.%d] Displayed last record data %d", i, i);
        	    });
        	});
        });
    });
}
strict();
