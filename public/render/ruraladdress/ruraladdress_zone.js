//const api_host = "http://localhost:3001";
const api_host = "https://apachecounty.org";
var transportations = [];
var markers = [];
var marker_markers = [];
var text = [];
var meta_data = []; // Meta data for all zones. Allows us to see last modified date to know if we should pull from 
					// localStorage or not

// Search
var current_search_pagination = 0;
var search_result_sets = [];

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = ["south", "west", "concho"];
var transportation_zones_starting_points = [
	{ lat: 33.9513, lon: -109.2292 }, 
	{ lat: 34.3693, lon: -109.7816 },
	{ lat: 34.5180075, lon: -109.69512700000001 }
];

// Only show valid zones
var trans_zone_index = valid_transportation_zones.indexOf(transportation_zone);
if ( trans_zone_index < 0) {
	transportation_zone = valid_transportation_zones[0];
	trans_zone_index = 0;
}

var trans_zone_starting_point = transportation_zones_starting_points[trans_zone_index];

$(document).ready(function() {
	initFeedback();
	initParcelParam();
	initSearchModal(transportation_zone);

	mapsScaleMilesHack();

	initLastModified();

});

/**
 * Load meta data for the zones. Compare with values in local storage to decide if we need to 
 * re-get the parcel data. If not, load from local storage instead.
 * 
 * Also acts as the callback from GMaps
 */
function initMetaData() {
	var uri = api_host + "/rural-addresses/meta-data";

	$.getJSON(uri, function (data) 
	{
		// Get the meta data info from local storage to compare
		var localData = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_META_DATA);

		// Flag to show which zone is currently in local storage, if any
		var zoneFlag = localStorageGetItemAsString(LOCAL_STORAGE_KEY_ZONE_FLAG);

		// Check if local storage meta data is here, if zone data is here, 
		// and if the zone in storage is the one we want to load. If not, load everything from scratch.
		if (localData == null || zoneFlag != transportation_zone) {
			load_from_local_storage.markers = false;
			load_from_local_storage.parcels = false;
			load_from_local_storage.roads = false;
			load_from_local_storage.text = false;

			// Save meta-data in local storage. Since we're starting fresh, wipe out the old stuff
			localStorage.clear();
			try {
				localStorageSetItem(LOCAL_STORAGE_KEY_META_DATA, JSON.stringify(data));
				localStorageSetItem(LOCAL_STORAGE_KEY_ZONE_FLAG, transportation_zone);

			}
			catch (e) {

			}

			initParcels();

			return;
		}

		if (JSON.stringify(data) == JSON.stringify(localData))  {
			initParcels();
			return; // Identical meta data for all zones, so load all components 
					// from local storage
		}
		
		// Data is different, so something has changed. Check the current zone
		var zone = data.find(zone => zone.name == transportation_zone);
		var localZone = localData.find(zone => zone.name == transportation_zone);

		if (JSON.stringify(zone) == JSON.stringify(localZone)) {
			initParcels();
			return; // Identical meta data for this zone, so load all components
					// from local storage
		}

		// This zone has changed, so see what's changed
		// Markers
		var markers = zone.files.find(file => file.name == "markers.json");
		var localMarkers = localZone.files.find(file => file.name == "markers.json");
		if (markers.lastModified != localMarkers.lastModified) load_from_local_storage.markers = false;
		
		// Parcels
		var parcels = zone.files.find(file => file.name == "parcels.json");
		var localParcels = localZone.files.find(file => file.name == "parcels.json");
		if (parcels.lastModified != localParcels.lastModified) load_from_local_storage.parcels = false;

		// Roads
		var roads = zone.files.find(file => file.name == "roads.json");
		var localRoads = localZone.files.find(file => file.name == "roads.json");
		if (roads.lastModified != localRoads.lastModified) load_from_local_storage.roads = false;

		// Text
		var text = zone.files.find(file => file.name == "text.json");
		var localText = localZone.files.find(file => file.name == "text.json");
		if (text.lastModified != localText.lastModified) load_from_local_storage.text = false;

		// Something changed, so update local storage
		localStorageSetItem(LOCAL_STORAGE_KEY_META_DATA, JSON.stringify(data));

		initParcels();
	});
}

function initParcelParam()
{
	// Get the parcel
	var parcel_num_param = getUrlParam("parcel");
	if ( parcel_num_param == null ) return;

	$("#select-mode-inner").hide();
}

/**
 * Load a map displaying the parcels. Click on a parcel to display info. If a zone number is provided,
 * load only the parcels in that zone. If not, load ALL the parcels
 * @param {*} zone_num 
 */
function initParcels(zone_num, starting_lat_lon, callback)
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

	// Load the measure tool from measure_tool.js
	initializeMeasureTool();

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
	
	// Load Parcels
	var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_PARCELS);
	if (load_from_local_storage.parcels == true && data != null) {
		// Local Storage
		console.log("Loaded from localStorage: Parcels");
		continueLoadingParcels(data);
	}
	else {
		// Get from API
		$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/parcels.json", function (data) 
		{
			// Store in local storage
			localStorageSetItem(LOCAL_STORAGE_KEY_PARCELS, JSON.stringify(data));

			continueLoadingParcels(data);
		});	
	}

	function continueLoadingParcels(data) {
		try
		{
			var features = map.data.addGeoJson(data);
			all_features = all_features.concat(features);
		}
		catch(err)
		{
			console.log(err);
		}

		loadingFadeOut();

		var parcel_num_param = getUrlParam("parcel");
		if ( parcel_num_param != null ) 
		{
			getParcelFromMap(parcel_num_param);
		}
	}
	

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

			marker_markers.push(marker);
		}
	}

	mapsScaleMilesHack();
	initGeoCode();
}

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

	for ( var i = 0; i < all_features.length; i++ ) 
	{
		var feature = all_features[i];

		// Sanitize the current parcel's parcel number
		var sanitized_feature_parcel_num = feature.getProperty('PARCEL_NUM');
		sanitized_feature_parcel_num = sanitized_feature_parcel_num.replace('-', '');
		while ( sanitized_feature_parcel_num.indexOf('-') >= 0 )
		{
			sanitized_feature_parcel_num = sanitized_feature_parcel_num.replace('-', ''); // Search ignores hyphens
		}
		sanitized_feature_parcel_num = sanitized_feature_parcel_num.toUpperCase(); // Search ignores case
		
		// Compare
		if ( sanitized_input == sanitized_feature_parcel_num )
		{
			$("#select-mode-inner").hide();

			showFeature(feature);
			selectFeature(feature);
			
			// Zoom in
			map.setZoom(15);
			return;
		}
	}
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
	var account_number = feature.getProperty('NUMBER');
	var owner = feature.getProperty('OWNER');
	var size = feature.getProperty('SIZE');
	if ( size ) size += " Ac."

	var show_mid_bar = ( account_number && owner && size );

	var info_box = document.getElementById('parcel_content');
	info_box.innerHTML = "";

	document.getElementById("parcelModalLabel").innerHTML = "Parcel " + parcel;

	renderModalProperty(info_box, "Situs", feature.getProperty('SITUS'));
	renderModalProperty(info_box, "CON", getCon(feature));

	var fire_district = getFireDistrict(feature);
	renderModalProperty(info_box, "Fire District", fire_district);

	if ( show_mid_bar == true ) renderModalProperty(info_box, "", "", "border-top my-3");
	renderModalProperty(info_box, "Owner", owner);
	renderModalProperty(info_box, "Account Information", account_number);
	renderModalProperty(info_box, "Size", size);

	// Edit History
	{
		$.getJSON(api_host + "/sheriff/edit-history/" + parcel, function (data)
		{
			renderModalProperty(info_box, "Situs", data.situs);
			renderModalProperty(info_box, "Owner", data.owner);
			renderModalProperty(info_box, "Remarks", data.remarks);

			if ( data.edits.length > 0 )
			{
				var edit_history_html = "<table class=\"editHistory\"><tr><th>Description</th><th>Date</th></tr>";
				for ( var i = 0; i < data.edits.length; i++ )
				{
					edit_history_html += "<tr>";
					edit_history_html += "<td>" + data.edits[i].text + "</td>";
					edit_history_html += "<td>" + data.edits[i].date + "</td>";
					edit_history_html += "</tr>";
				}
				edit_history_html += "</table>";
				renderModalProperty(info_box, "Edits", edit_history_html);
			}
		});
	}

	document.getElementById("button-link-parcel-feedback").onclick = () => {
		showParcelFeedbackModal(parcel);
	}

	document.getElementById("button-link-fire-truck-dispatch").onclick = () => {
		showFireTruckDispatchModal(parcel, fire_district);
	}

	$("#parcelModal").modal("show");

	selectFeature(feature);
}

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host 
 */
function initSpecific(api_host)
{
    loadingFadeIn();

	// Load Roads
	var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_ROADS);
	if (load_from_local_storage.roads == true && data != null) {
		// Local Storage
		console.log("Loaded from localStorage: Roads");
		continueLoadingRoads(data);
	}
	else {
		// Get from API
		$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/roads.json", function (data) 
		{
			// Store in local storage
			localStorageSetItem(LOCAL_STORAGE_KEY_ROADS, JSON.stringify(data));
			
			continueLoadingRoads(data);
		});
	}

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
					strokeWeight: 3,
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
			else if ( transportations.indexOf(event.feature) >= 0 )
			{
				displayMarker(event.feature);
			}
			else
			{
				displayParcel(event.feature);
			}

			current_parcel_marker = labelFeature(event.feature.getProperty('PARCEL_NUM'), event.feature, true);
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

function showParcelFeedbackModal(apn) {
	var parcel = edit_history_search_set.find(parcel => {
		return parcel.apn == apn;
	});

	if (parcel == null) return;

	var container = document.getElementById("feedback-parcel-info");
	container.innerHTML = "";

	var apn = document.createElement("span");
	apn.innerHTML = "<b>APN</b>: " + parcel.apn;
	container.appendChild(apn);

	if (parcel.owner) {
		container.appendChild(document.createElement("br"));

		var owner = document.createElement("span");
		owner.innerHTML = "<b>Owner</b>: " + parcel.owner;
		container.appendChild(owner);
	}
	
	if (parcel.road) {
		container.appendChild(document.createElement("br"));

		var road = document.createElement("span");
		road.innerHTML = "<b>Road</b>: " + parcel.road;
		container.appendChild(road);
	}
	

	$("#parcelFeedbackModalLabelTitle").html(parcel.apn);
	
	$("#parcelFeedbackModal").modal("show");

	// Remove other handlers from previous modal opens
	$("#submit-parcel-feedback-button").off();

	$("#submit-parcel-feedback-button").click((e) => {
		e.preventDefault();
		// Combine parcel JSON with form data and post as request body (AJAX)
		var body = {};
		body.parcel = parcel;
		body.name = document.getElementById("parcel-feedback-name").value;
		body.email = document.getElementById("parcel-feedback-email").value;
		body.feedback = document.getElementById("parcel-feedback-feedback").value;

		if (body.email.length <= 0 || body.name.length <= 0 || body.feedback.length <= 0) return;
		
		$.post( "/rural-address/send-feedback", body, function( data ) {
			$("#parcelFeedbackModal").modal("hide");
		  });
	});
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
		
		$.post( "/rural-address/fire-truck-dispatch", body, function() {
			$("#fireTruckDispatchModal").modal("hide");
		  });
	});
}