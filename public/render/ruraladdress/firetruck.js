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

	// Load Roads
	var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_ROADS);
	if (load_from_local_storage && load_from_local_storage.roads == true && data != null) {
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
	renderModalProperty(info_box, "Fire District", getFireDistrict(feature));
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
	
	$("#parcelModal").modal("show");

	selectFeature(feature);
}