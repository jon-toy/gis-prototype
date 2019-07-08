/**
 * A reduced form of the Rural Address Viewer: 
 * - Shows an empty map with current user location
 * - Can search for a parcel and display the SITUS for it
 */

const api_host = "https://apachecounty.org";

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = ["south", "vernon", "north", "east", "concho"];
var transportation_zones_starting_points = [
	{ lat: 33.9513, lon: -109.2292 }, 
	{ lat: 34.3693, lon: -109.7816 },
	{ lat: 34.3693, lon: -109.7816 },
	{ lat: 34.3693, lon: -109.7816 },
	{ lat: 34.5180075, lon: -109.69512700000001 }
];

var transportations = [];

// Only show valid zones
var trans_zone_index = valid_transportation_zones.indexOf(transportation_zone);
if ( trans_zone_index < 0) {
	transportation_zone = valid_transportation_zones[0];
	trans_zone_index = 0;
}

var trans_zone_starting_point = transportation_zones_starting_points[trans_zone_index];
var user_lat_lon, user_marker;
var viewedFeature;
var bounds;
var markers = [];
var marker_markers = [];

$(document).ready(function() {
	initFeedback();
	initSearchModal(transportation_zone);

	mapsScaleMilesHack();
	initLastModified();
});

function initParcelParam()
{
	// Get the parcel
	var parcel_num_param = getUrlParam("parcel");
	if ( parcel_num_param == null ) return;

	$("#select-mode-inner").hide();
	getParcelFromMap(parcel_num_param, false);
}

function initParcels(starting_lat_lon)
{
	bounds = new google.maps.LatLngBounds();
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
		displayOwnerAndDistance(event.feature);

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
			// for ( var i = 0; i < parcel_num_markers.length; i++ )
			// {
			// 	parcel_num_markers[i].setMap(null);
			// }

			// parcel_num_markers = [];
		}
	});

	// Load sheriff specific GeoJSONs
	initFireCon(api_host);

	initSpecific(api_host);

	mapsScaleMilesHack();
	initFireTruckGeoCode();

	// Load Markers
	var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_MARKERS);
	if (load_from_local_storage.markers == true && data != null) {
		// Local Storage
		console.log("Loaded from localStorage: Markers");
		continueLoadingMarkers(data);
	}
	else {
		// Get from API
		$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/markers.json", function (data) 
		{
			// Store in local storage
			localStorageSetItem(LOCAL_STORAGE_KEY_MARKERS, JSON.stringify(data));

			continueLoadingMarkers(data);
		});
	}

	function continueLoadingMarkers(data) {
		markers = map.data.addGeoJson(data);
		for (var i = 0; i < markers.length; i++) {
			markers[i].setProperty("marker", true);
		}
	}
	
	// Load Text
	var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_TEXT);
	if (load_from_local_storage.text == true && data != null) {
		// Local Storage
		console.log("Loaded from localStorage: Text");
		continueLoadingText(data);
	}
	else {
		// Get from API
		$.getJSON(api_host +"/transportation/zones/" + transportation_zone + "/text.json", function (data) 
		{
			// Store in local storage
			localStorageSetItem(LOCAL_STORAGE_KEY_TEXT, JSON.stringify(data));
	
			continueLoadingText(data);
		});
	}

	function continueLoadingText(data) {
		var buffer = new google.maps.Data();
		text = buffer.addGeoJson(data);

		for ( var i = 0; i < text.length; i++ )
		{	
			// Create a label
			var marker = new google.maps.Marker({
				position: text[i].getGeometry().get(),
				label: text[i].getProperty("TEXTSTRING"),
				map: null,
				icon: {
					path: google.maps.SymbolPath.CIRCLE,
					scale: 0
				}
			});
			markers.push(text[i]);
			marker_markers.push(marker);
		}
	}

    loadingFadeOut();
}

function displayOwnerAndDistance(feature) {
	// Calculate distance from user lat lon to center
	var geom = feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});
	var feature_lat_lon = getPolygonCenter(poly);
	document.getElementById("parcel-num-display").innerHTML = "OWNER: " + feature.getProperty('OWNER') + " DISTANCE: " + getMiles(google.maps.geometry.spherical.computeDistanceBetween(feature_lat_lon, user_lat_lon))
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
						strokeOpacity: 0.4,
						strokeWeight: 5,
						zIndex: 5
					});
				}
				
				return ({
					strokeColor: "#FF0000",
					strokeOpacity: 0.4,
					strokeWeight: 5, 
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
				showSitusMarkers(event.feature.getProperty("NUMBER"));
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
			else if ( markers.indexOf(event.feature) >= 0 )
			{
				displayMarker(event.feature);
			}
			else
			{
				displayOwnerAndDistance(event.feature);
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

/**
 * Parse out properties from the transportation feature, place those properties into the Transportation Modal,
 * and show it.
 * @param {*} feature 
 */
function showTransportation(feature)
{	  
	map.data.revertStyle();
    map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'blue', strokeColor:'blue'});

    var info_box = document.getElementById('transportation_content');
	info_box.innerHTML = "";

	document.getElementById("transportationModalLabel").innerHTML = "Road " + feature.getProperty("NUMBER");

    renderModalProperty(info_box, "Number 0", feature.getProperty('NUMBER0'));
    renderModalProperty(info_box, "Road Name", feature.getProperty('ROAD_NAME'));
    renderModalProperty(info_box, "Number 1", feature.getProperty('NUMBER1'));
	
	$("#transportationModal").modal("show");

    selectFeature(feature);
    
    function renderModalProperty(container, title, content, css_classes)
	{
		if ( content == null ) return;

		var row = document.createElement('div');
		row.className = "row p-2";

		var title_container = document.createElement('div');
		title_container.className = 'col-3';
		title_container.innerHTML = '<b>' + title + '</b>';
		row.appendChild(title_container);

		var content_container = document.createElement('div');
		content_container.className = 'col-9';
		content_container.innerHTML = content;
		row.appendChild(content_container);

		if ( css_classes ) row.className = css_classes;

		container.appendChild(row);
	}
}

function showSitusMarkers(number) {
	for ( var i = 0; i < marker_markers.length; i++ )
	{
		if ( marker_markers[i].getLabel().indexOf(number.toUpperCase()) >= 0 )
			marker_markers[i].setMap(map);
		else
			marker_markers[i].setMap(null);
	}
}

/**
 * Get the feature/parcel from the map, given a parcel number
 * @param {} parcel_num 
 */
function getParcelFromMap(parcel_num, doCenter, doZoom)
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

		showFeature(feature[0], doCenter);
		viewedFeature = feature[0];

		var geom = viewedFeature.getGeometry();
		var poly = new google.maps.Polygon({
			paths: geom.getAt(0).getArray(),
		});

		bounds = new google.maps.LatLngBounds(null);
		bounds.extend(user_marker.getPosition());
		
		var lat_lon = getPolygonCenter(poly);
		bounds.extend(lat_lon);
		map.fitBounds(bounds);
		map.setCenter(bounds.getCenter());

        
        // Zoom in
        if (doZoom === true) map.setZoom(15);
        return;
    });
}

/**
 * Parse out properties from the feature, place those properties into the Parcel Modal,
 * and show it.
 * @param {*} feature 
 */
function showFeature(feature, doCenter)
{	  
	if (doCenter == null) doCenter = true;
	map.data.revertStyle();
	map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'blue', strokeColor:'blue'});
	
	// Feature properties that we need to get in advance
	var parcel = feature.getProperty('PARCEL_NUM');
	var owner = feature.getProperty('OWNER');

	var info_box = document.getElementById('parcel_content');
	info_box.innerHTML = "";

	renderModalProperty(info_box, "CON", getCon(feature));

	var fire_district = getFireDistrict(feature);
	renderModalProperty(info_box, "Fire District", fire_district);
	renderModalProperty(info_box, "Owner", owner);

	// Calculate distance from user lat lon to center
	var geom = feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});
	var feature_lat_lon = getPolygonCenter(poly);
	if (user_lat_lon != null)
		renderModalProperty(info_box, "Distance", getMiles(google.maps.geometry.spherical.computeDistanceBetween(feature_lat_lon, user_lat_lon)))

	// Edit History
	{
		$.getJSON(api_host + "/sheriff/edit-history/" + parcel, function (data)
		{
			renderModalProperty(info_box, "Situs", data.situs);
			document.getElementById("parcelModalLabel").innerHTML = data.situs;
			selectFeature(feature, data.situs, doCenter);
		});
	}

	document.getElementById("button-link-fire-truck-dispatch").onclick = () => {
		showFireTruckDispatchModal(parcel, fire_district);
	}
	
	$("#parcelModal").modal("show");
}

function getMiles(i) {
	return (Math.round(10*i*0.000621371192)/10) + " Miles";
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
		var subset = results.splice(0, arraySize);
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
				getParcelFromMap(apn, false, false);
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

/**
 * Initialize the GeoLocation so the user can see where they are on the map. 
 * Then, given a parcel, zoom out to show both
 */
function initFireTruckGeoCode(feature)
{
	// GeoMarker stuff
	navigator.geolocation.getCurrentPosition((position) => {
		geoInit(position);
		goToUserLatLon();
		initParcelParam();
	});
	
	function geoInit(position)
	{
		user_lat_lon = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
		
		user_marker = new google.maps.Marker({
				position: user_lat_lon,
				map: map,
				icon: "/geolocation-icon.png"
			});
		
			setInterval(function() {
				navigator.geolocation.getCurrentPosition((position) => {
					user_lat_lon = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
					user_marker.setPosition(user_lat_lon);
				});
			  }, 3000);
		
		// Extend view to fit user
		bounds.extend(user_marker.getPosition());
		map.fitBounds(bounds);
		map.setCenter(bounds.getCenter());
	}
}

function showFireTruckDispatchModal(apn, fire_district) {	
	$("#fireTruckDispatchModal").modal("show");

	// Remove other handlers from previous modal opens
	$("#fire-truck-dispatch-button").off();

	$('.fire-truck-dispatch-choices').prop('checked', false); // Uncheck all boxes
	
	// Find a default box to check
	if (fire_district === 'Alpine') {
		$('#fire-truck-dispatch-choices-alpine').prop('checked', true);
	} else if (fire_district === 'Eagar') {
		$('#fire-truck-dispatch-choices-eagar').prop('checked', true);
	} else if (fire_district === 'Vernon') {
		$('#fire-truck-dispatch-choices-vernon').prop('checked', true);
	}

	$("#fire-truck-dispatch-button").click((e) => {
		e.preventDefault();
		// Combine parcel JSON with form data and post as request body (AJAX)
		var body = {};
		body.recipients = [];
		body.apn = apn;

		$("input:checkbox[name=fire-truck-dispatch-choices]:checked").each(function(){
			body.recipients.push($(this).val());
		});
		console.log(body.recipients);

		if (body.recipients.length <= 0) return;

		body.subject = $('#fire-truck-dispatch-subject').val();
		
		$.post( "/rural-address/fire-truck-dispatch", body, function() {
			$("#fireTruckDispatchModal").modal("hide");
		  });
	});
}