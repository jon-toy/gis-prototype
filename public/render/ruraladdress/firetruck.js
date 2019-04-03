/**
 * A reduced form of the Rural Address Viewer: 
 * - Shows an empty map with current user location
 * - Can search for a parcel and display the SITUS for it
 */

const api_host = "https://apachecounty.org";

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = ["south", "west", "concho"];
var transportation_zones_starting_points = [
	{ lat: 33.9513, lon: -109.2292 }, 
	{ lat: 34.3693, lon: -109.7816 },
	{ lat: 34.5180075, lon: -109.69512700000001 }
];

var transportations;

// Only show valid zones
var trans_zone_index = valid_transportation_zones.indexOf(transportation_zone);
if ( trans_zone_index < 0) {
	transportation_zone = valid_transportation_zones[0];
	trans_zone_index = 0;
}

var trans_zone_starting_point = transportation_zones_starting_points[trans_zone_index];
var user_lat_lon;

$(document).ready(function() {
	initFeedback();
	initSearchModal(transportation_zone);

	mapsScaleMilesHack();
	initLastModified();
});

function initParcels(starting_lat_lon)
{
	loadingFadeIn();

	// Create the Map object
	var starting_zoom = 14;

	if ( starting_lat_lon == null ) starting_lat_lon = new google.maps.LatLng(trans_zone_starting_point.lat, trans_zone_starting_point.lon); // Starting position
	if ( starting_zoom == null ) starting_zoom = FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD;

	map = new google.maps.Map(document.getElementById('map'), {
	center: starting_lat_lon,
	zoom: starting_zoom,
	fullscreenControl: false,
	scaleControl: true,
	gestureHandling: 'greedy'
	});

	// Highlight the parcels
	map.data.addListener('mouseover', function(event) {
		var color = '#28a745';
		map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:color, strokeColor:color});
		displayCoordinates(event.latLng);
		displayParcel(event.feature);

		current_parcel_marker = labelFeature(event.feature.getProperty('PARCEL_NUM'), event.feature, true);
	});

	map.data.addListener('mouseout', function(event) {

		map.data.revertStyle();

		if ( current_parcel_marker != null )
		{
			current_parcel_marker.setMap(null);
		}
	});	

	// Show modal on click
	map.data.addListener('click', function(event) 
	{			
		showFeature(event.feature);
		
		event.feature.setProperty('selected', true);
	});

	// Populate the Lat Lon. Separate from the mouseover so we keep track outside the parcels
	google.maps.event.addListener(map, 'mousemove', function (event) {
		displayCoordinates(event.latLng);               
	});


	// Wipe out the labels after we zoom out enough so it doesn't clutter the map
	map.addListener('zoom_changed', function() {
		if ( map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD )
		{
			// Wipe markers
			for ( var i = 0; i < parcel_num_markers.length; i++ )
			{
				parcel_num_markers[i].setMap(null);
			}

			parcel_num_markers = [];
		}
	});

	// Load sheriff specific GeoJSONs
	initFireCon(api_host);

	initSpecific(api_host);

	mapsScaleMilesHack();
    initGeoCode(true);

    loadingFadeOut();
}

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host 
 */
function initSpecific(api_host)
{
    loadingFadeIn();

	// Get from API
	$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/roads.json", function (data) 
	{	
		continueLoadingRoads(data);
	});

	function continueLoadingRoads(data) {
		transportations = map.data.addGeoJson(data);
		loadingFadeOut();

		// Set colors
		map.data.setStyle(function(feature) {
			// Transporation
			if ( transportations.indexOf(feature) >= 0 )
			{
				if (feature.getProperty('selected')) 
				{
					return ({
						strokeColor: "'#20c997'",
						strokeOpacity: 0.8,
						strokeWeight: 3,
						zIndex: 5
					});
				}
				
				return ({
					strokeColor: "#FF0000",
					strokeOpacity: 0.8,
					strokeWeight: 0,  // Hide roads for now
					zIndex: 5
				});
			}
		
			// Parcels
			var color = '#007bff';

			// Change the color of the feature permanently
			if (feature.getProperty('selected')) 
			{
				color = '#20c997';
			}

			if (feature.getProperty('marker')) {
				color = "#993300";
			}

			return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			fillOpacity: 0.2,
			strokeColor: color,
			strokeWeight: 1
			});
		});

		// Remove all listeners
		google.maps.event.clearListeners(map.data, 'click');
		google.maps.event.clearListeners(map.data, 'mouseover');
		
		// Show modal on click
		map.data.addListener('click', function(event) 
		{	
			for ( var i = 0; i < transportations.length; i++ )
				transportations[i].setProperty('selected', false);

			event.feature.setProperty('selected', true);

			// Transporation
			if ( transportations.indexOf(event.feature) >= 0 )
			{
				//showSitusMarkers(event.feature.getProperty("NUMBER"));
				return showTransportation(event.feature)
			}

			showFeature(event.feature);
		});
		
		// Mouse over
		map.data.addListener('mouseover', function(event) {
			var color = '#28a745';
			map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:color, strokeColor:color});
			displayCoordinates(event.latLng);
			
			if ( transportations.indexOf(event.feature) >= 0 )
			{
				displayTransportation(event.feature);
			}
			else if ( transportations.indexOf(event.feature) >= 0 )
			{
				displayMarker(event.feature);
			}
			else
			{
				displayParcel(event.feature);
			}

			current_parcel_marker = labelFeature(event.feature.getProperty('situs'), event.feature, true);
		});
	}
}

/**
 * Display the Transportation on the bottom bar
 * @param {*} feature 
 */
function displayTransportation(feature) 
{
    document.getElementById("parcel-num-display").innerHTML = "Road: " + feature.getProperty('NUMBER');
}

// function showSitusMarkers(number) {
// 	for ( var i = 0; i < marker_markers.length; i++ )
// 	{
// 		if ( marker_markers[i].getLabel().indexOf(number.toUpperCase()) >= 0 )
// 			marker_markers[i].setMap(map);
// 		else
// 			marker_markers[i].setMap(null);
// 	}
// }

/**
 * Get the feature/parcel from the map, given a parcel number
 * @param {} parcel_num 
 */
function getParcelFromMap(parcel_num)
{
	if ( parcel_num == null ) parcel_num = document.getElementById("search-by-parcel-number").value;
	if ( parcel_num == null || parcel_num.length <= 0 ) return;

	// Sanitize the input value
	var sanitized_input = parcel_num.replace('-', '');
	while ( sanitized_input.indexOf('-') >= 0 )
	{
		sanitized_input = sanitized_input.replace('-', ''); // Search ignores hyphens
	}
	sanitized_input = sanitized_input.toUpperCase(); // Search ignores case

    // Get from API
    $.getJSON(api_host + "/parcels/" + sanitized_input,function (data) {
        // Add to map
        var feature = map.data.addGeoJson(data);        

         // Show it
        $("#select-mode-inner").hide();

        showFeature(feature[0]);
        
        // Zoom in
        map.setZoom(15);
        return;
    });
}

/**
 * Parse out properties from the feature, place those properties into the Parcel Modal,
 * and show it.
 * @param {*} feature 
 */
function showFeature(feature)
{	  
	map.data.revertStyle();
	map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'blue', strokeColor:'blue'});
	
	// Feature properties that we need to get in advance
	var parcel = feature.getProperty('PARCEL_NUM');
	var owner = feature.getProperty('OWNER');

	var info_box = document.getElementById('parcel_content');
	info_box.innerHTML = "";

	renderModalProperty(info_box, "CON", getCon(feature));
	renderModalProperty(info_box, "Fire District", getFireDistrict(feature));
	renderModalProperty(info_box, "Owner", owner);

	// Edit History
	{
		$.getJSON(api_host + "/sheriff/edit-history/" + parcel, function (data)
		{
			renderModalProperty(info_box, "Situs", data.situs);
			document.getElementById("parcelModalLabel").innerHTML = data.situs;
			selectFeature(feature, data.situs);
		});
	}
	
	$("#parcelModal").modal("show");
}

var edit_history_search_set = [];

/**
 * Set up the Rural Address Search Modal
 */
function initSearchModal(transportation_zone) {

	var uri = api_host + "/rural-addresses/edit-history/" + transportation_zone;

	// Initial handler
	$("#searchValue").on("input", () => {
		doSearch();
	});

	$('#searchBy').on('change', function() {
		// Reset the search value container
		$("#searchValueLabel").html("Search Contains");
		$("#searchValueContainer").html("<input class=\"form-control\" id=\"searchValue\"/>");

		$("#searchValue").on("input", () => {
			doSearch();
		});

		doSearch();
	  });

	$.getJSON(uri, function (data) 
	{
		if ( data.error_message )
		{
			console.log(data.error_message);
			$("#select-mode-inner").show();
			return;
		}

		edit_history_search_set = data;

		// Populate initial
		doSearch($("#searchBy").val(), $(".searchBy option:selected").val());
	});
}

function doSearch() {

	var value = document.getElementById("searchValue").value.toUpperCase();
	var type = $("#searchBy option:selected").val();

	var results = [];
	
	if (type === "situs") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.situs.toUpperCase().indexOf(value) >= 0;
		});
	} else if ( type === "road") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.road.toUpperCase().indexOf(value) >= 0;
		});
	} else if ( type === "road_name") {
		// Get a list of all road numbers that match this road name
		var roads = transportations.filter(road => {
			var name = road.getProperty('ROAD_NAME');
			return name != null && name.toUpperCase().indexOf(value) >= 0;
		});

		roads = roads.map(road => {
			var roadNum = road.getProperty("NUMBER");
			if (roadNum) roadNum = roadNum.toUpperCase();
			return roadNum;
		});

		results = edit_history_search_set.filter(parcel => {
			var parcelRoadUpper = parcel.road;
			if (parcelRoadUpper) parcelRoadUpper = parcelRoadUpper.toUpperCase();
			return roads.indexOf(parcelRoadUpper) >= 0;
		});
	} else if ( type === "owner") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.owner.toUpperCase().indexOf(value) >= 0;
		});
	} 
	else {
		// Default to Situs
		results = edit_history_search_set.filter(parcel => {
			return parcel.situs.indexOf(value) >= 0;
		});
	}

	renderSearchResults(results);
}

function renderSearchResults(results) {

	$("#results_total").html(results.length);

	search_result_sets = []; // Split the results up into an array of arrays
	var arraySize = 20;
	var i, j;
	for (i = 0, j = results.length; i < j; i+= arraySize) {
		var subset = results.splice(i, arraySize);
		if (subset.length <= 0) break;
		
		search_result_sets.push(subset);
	}

	if (search_result_sets.length <= 0) search_result_sets.push([]);

	current_search_pagination = 0;
	renderTwentyResults(search_result_sets[current_search_pagination]); // Show the first subset by default

	if (search_result_sets.length >= 1) {
		renderSearchPagination();
	}

	function renderTwentyResults(resultssubset) {
		var body = document.getElementById("resultsTableBody");
		body.innerHTML = "";

		for (var i = 0; i < resultssubset.length; i++) {
			var parcel = resultssubset[i];
			var row = document.createElement("tr");
			row.className = "pointer";

			// Go to Parcel
			var cell = document.createElement("td");
			var link_to_parcel = document.createElement("a");
			link_to_parcel.innerHTML = "Go to Parcel";
			link_to_parcel.setAttribute("href", "#");
			link_to_parcel.setAttribute("data-toggle", "collapse");
			link_to_parcel.setAttribute("data-target", "#navbarSupportedContent");

			row.setAttribute("data-dismiss", "modal");
			row.onclick = getParcelFromMapClosure(parcel.apn);

			$(cell).append(link_to_parcel);
			$(row).append(cell);

			$(row).append("<td>" + parcel.situs + "</td>");
			$(row).append("<td>" + parcel.owner + "</td>");

			var roadName = getRoadNameFromNumber(parcel.road);
			$(row).append("<td>" + parcel.road + "</td><td>" + (roadName ? roadName : "") + "</td>");

			$(body).append(row);
		};

		function getParcelFromMapClosure(apn) {
			return function() {
				getParcelFromMap(apn);
			}
		}
	}
	
	function renderSearchPagination() {
		$("#search_previous").off();
		$("#search_next").off();

		if (current_search_pagination == 0) {
			$("#search_previous").html("");
		} 
		else {
			$("#search_previous").html("Previous 20");
			
			$("#search_previous").on("click", function() {
				current_search_pagination--;
				renderTwentyResults(search_result_sets[current_search_pagination]);
				renderSearchPagination();
			});
		}

		if (current_search_pagination == search_result_sets.length - 1) {
			$("#search_next").html("");
		}
		else {
			$("#search_next").html("Next 20");
			$("#search_next").on("click", function() {
				current_search_pagination++;
				renderTwentyResults(search_result_sets[current_search_pagination]);
				renderSearchPagination();
			});
		}
	}
}

/**
 * Update last modified date in footer from data API
 */
function initLastModified() {
	var uri = api_host + "/rural-addresses/edit-history/";

	$.getJSON(uri, function (data) 
	{
		var text = document.getElementById("editHistoryLastUpdated");

		var zone = data.zones.find(zone => zone.name == transportation_zone);

		if (zone) {
			var date = new Date(zone.lastModified);
			text.innerHTML = "Last Modified: " + (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();
		}
	});
}

function getRoadNameFromNumber(roadNumber) {
	var roadNumberUpper = roadNumber.toUpperCase();
	var road =  transportations.find(road => {
		var loopRoad = road.getProperty("NUMBER");
		if (loopRoad) loopRoad = loopRoad.toUpperCase();
		return roadNumberUpper == loopRoad;
	});

	return (road ? road.getProperty("ROAD_NAME") : null);
}