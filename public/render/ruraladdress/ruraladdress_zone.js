/*
Edit History Zone JS is designed to be able to load a transportation zone (parcels, markers, roads, text) based on a
URL parameter. This URL parameter helps decide the path to get from the data API.
*/

const FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD = 13; // Hide markers below this threshold

var map, GeoMarker; // Google Maps API objects
var geo_json_urls = []; // URLs for all the GeoJSON objects after listing the results from the server.
						// Global so we can access it in callbacks
var all_features = []; // Unreliable on page load. Used for calls to action after page render
var parcel_num_markers = []; // Store references to all markers currently on the page so we can manipulate en masse
var cons = [];
var fires = [];
var markers = [];
var marker_markers = [];
var text = [];
var user_lat_lon = null;
var current_parcel_marker = null;
var current_zone = null;
var all_zones = [];
var edit_history_search_set = [];

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = ["south", "west"];
var transportation_zones_starting_points = [
	{ lat: 33.9513, lon: -109.2292 }, 
	{ lat: 34.3693, lon: -109.7816 }
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
	initSearchModal();

	$('#search-by-parcel-number-button').click(function(event) {

        // Stop the Search input reloading the page by preventing its default action
		event.preventDefault();
		
		searchByParcelNumLoadZone();
	});

	mapsScaleMilesHack();

  });

/**
 * Set up the Rural Address Search Modal
 */
function initSearchModal() {

	var uri = "https://apachecounty.org/rural-addresses/edit-history/" + transportation_zone;

	var searchBox = document.getElementById("searchValue");
	$(searchBox).keyup(() => {
		doSearch(searchBox.value, $("#searchBy option:selected").val());
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
		doSearch(searchBox.value, $(".searchBy option:selected").val());
	});
}

function doSearch(value, type) {
	var results = [];
	
	if (type === "situs") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.situs.indexOf(value) >= 0;
		});
	} else if ( type === "road") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.road.indexOf(value) >= 0;
		});
	}
	else {
		results = edit_history_search_set.filter(parcel => {
			return parcel.apn.indexOf(value) >= 0;
		});
	}

	renderSearchResults(results);

	function renderSearchResults(results) {
		var body = document.getElementById("resultsTableBody");
		body.innerHTML = "";

		for (var i = 0; i < 20 && i < results.length; i++) { // Only show the first 20 results
			var parcel = results[i];
			var row = document.createElement("tr");
			$(row).append("<td>" + parcel.apn + "</td><td>" + parcel.situs + "</td><td>" + parcel.road + "</td>");

			var cell = document.createElement("td");
			var link_to_parcel = document.createElement("a");
			link_to_parcel.innerHTML = "Go to Parcel";
			link_to_parcel.setAttribute("data-dismiss", "modal");
			link_to_parcel.setAttribute("href", "#");
			link_to_parcel.onclick = getParcelFromMapClosure(parcel.apn);

			$(cell).append(link_to_parcel);
			$(row).append(cell);
			$(body).append(row);
		};

		function getParcelFromMapClosure(apn) {
			return function() {
				getParcelFromMap(apn);
			}
		}
	}
}
function initParcelParam()
{
	// Get the parcel
	var parcel_num_param = getUrlParam("parcel");
	if ( parcel_num_param == null ) return;

	$("#select-mode-inner").hide();
	//searchByParcelNumLoadZone(parcel_num_param, true)
}

/**
 * Search for a parcel, given a parcel. If the parcel is outside the currently loaded zone, load it
 * @param {} parcel_num 
 */
function searchByParcelNumLoadZone(parcel_num, skip_confirm)
{
	if ( parcel_num == null ) parcel_num = document.getElementById("search-by-parcel-number").value;

	var uri = "https://apachecounty.org/parcels/" + parcel_num;

	if ( parcel_num.startsWith("R") )
	{
		// This is an account number instead
		uri = "https://apachecounty.org/accounts/" + parcel_num;
	}

	$.getJSON(uri, function (data) 
	{
		if ( data.error_message )
		{
			console.log(data.error_message);
			$("#select-mode-inner").show();
			return;
		}

		var buffer = new google.maps.Data();
		var features = buffer.addGeoJson(data);
		feature = features[0]; // Should only load one;

		// Get the center point
		var parcel_geom = feature.getGeometry();
		var parcel_poly = new google.maps.Polygon({
			paths: parcel_geom.getAt(0).getArray(),
		});
		var starting_lat_lon = getPolygonCenter(parcel_poly);

		var book = feature.getProperty("PARCEL_NUM").substring(0, 3);
		var zone_uri = "https://apachecounty.org/zone/" + book;
		$.getJSON(zone_uri, function (data)
		{
			if ( data.error_message )
			{
				console.log(data.error_message);
				return;
			}

			if ( current_zone == 'all' || current_zone == data.zone )
			{
				// No need to load the zone again, just pan to the parcel
				getParcelFromMap(feature.getProperty("PARCEL_NUM"));
				return;
			}
			
			if ( skip_confirm )
			{
				$('#navbar-title').html(getZoneName(data.zone) + " Parcel Viewer");
				initParcels(data.zone, starting_lat_lon, function()
				{
					getParcelFromMap(feature.getProperty("PARCEL_NUM"));
				});
			}
			else
			{
				$('#confirmZoneLoadModal').modal('show');
				$('#confirmZoneModalCurrentZone').html(getZoneName(current_zone));
				$('#confirmZoneModalNewZone').html(getZoneName(data.zone));
				$("#confirmZoneLoadModalButton").on('click', function()
				{
					initParcels(data.zone, starting_lat_lon, function()
					{
						getParcelFromMap(feature.getProperty("PARCEL_NUM"));
					});
				});
			}
		});
	});
}

/**
 * Helper function to get URL Parameters
 * @param {*} name of the parameter
 */
function getUrlParam(name)
{
	var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);

	if ( results == null ) return null;

	return results[1] || 0;
}

/**
 * Set up the reCaptcha listeners
 */
function initFeedback()
{
	window.verifyRecaptchaCallback = function (response) {
        $('input[data-recaptcha]').val(response).trigger('change')
    }

    window.expiredRecaptchaCallback = function () {
        $('input[data-recaptcha]').val("").trigger('change')
    }

	$('#submit-feedback-form').submit(function() {
	  $(this).ajaxSubmit({
		error: function(xhr) {
		  status('Error: ' + xhr.status);
		},
	   success: function(response) {
		if ( response.success == true )
		{
			alert("Thank you for submitting feedback, " + response.name + "!");
			$('#feedbackModal').modal('hide');
		}
		else
		{
			alert(response.message);
		}

		grecaptcha.reset();
	   }
	  });

	  //Very important line, it disable the page refresh.
	  return false;
	});
}  

/**
 * Load a map displaying the parcels. Click on a parcel to display info. If a zone number is provided,
 * load only the parcels in that zone. If not, load ALL the parcels
 * @param {*} zone_num 
 */
function initParcels(zone_num, starting_lat_lon, callback)
{
	loadingFadeIn();

	//var api_host = "http://localhost:3001";
	var api_host = "https://apachecounty.org";

	// Create the Map object
	var starting_zoom = 14;

	//if ( starting_lat_lon == null ) starting_lat_lon = new google.maps.LatLng(34.0136, -109.4554); // Starting position
	if ( starting_lat_lon == null ) starting_lat_lon = new google.maps.LatLng(trans_zone_starting_point.lat, trans_zone_starting_point.lon); // Starting position
	if ( starting_zoom == null ) starting_zoom = FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD;

	map = new google.maps.Map(document.getElementById('map'), {
	center: starting_lat_lon,
	zoom: starting_zoom,
	fullscreenControl: false,
	scaleControl: true
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

	// Set colors
	map.data.setStyle(function(feature) {
		var color = '#007bff';

		// Change the color of the feature permanently
		if (feature.getProperty('selected')) 
		{
			color = '#20c997';
		}

		return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			fillOpacity: 0.4,
			strokeColor: color,
			strokeWeight: 1
			});
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
	initSheriff(api_host);

	initSpecific(api_host);
	
	// Load Parcels
	$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/parcels.json", function (data) 
	{
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

	});	

	// Load Markers
	$.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/markers.json", function (data) 
	{
		markers = map.data.addGeoJson(data);
	});

	// Load Text
	$.getJSON(api_host +"/transportation/zones/" + transportation_zone + "/text.json", function (data) 
	{
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
	});

	mapsScaleMilesHack();

	/**
	 * Grab cons and fire GeoJSONs to load them specially into memory
	 * @param {} api_host 
	 */
	function initSheriff(api_host)
	{
		var buffer = new google.maps.Data();

		$.getJSON(api_host + "/sheriff/con.json", function (data) 
		{
			cons = buffer.addGeoJson(data);
		});

		$.getJSON(api_host + "/sheriff/fire.json", function (data) 
		{
			fires = buffer.addGeoJson(data);
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
 * Display the Parcel Number on the bottom bar
 * @param {*} feature 
 */
function displayParcel(feature) 
{
	document.getElementById("parcel-num-display").innerHTML = "Parcel Number: " + feature.getProperty('PARCEL_NUM');
}

/**
 * Hack to force a click to set the km to miles on the map
 */
function mapsScaleMilesHack()
{
	var scaleInterval = setInterval( function() {
		var spn = document.getElementById('map').getElementsByTagName('span');
		var pattern = /\d+\s+(m|km)/i;
		for(var i in spn) {
			if ( pattern.test(spn[i].innerHTML) ) {
			spn[i].click();
			clearInterval(scaleInterval);
			}
		}
		}, 500);
		setTimeout( function() { clearInterval(scaleInterval) }, 20000 );
}

/**
 * Initialize the GeoLocation so the user can see where they are on the map
 */
function initGeoCode()
{
	// GeoMarker stuff
	locate();
	function locate()
	{
        navigator.geolocation.getCurrentPosition(geoInit);
    }
	
	function geoInit(position)
	{
		user_lat_lon = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
		
		 var userMarker = new google.maps.Marker({
				position: user_lat_lon,
				map: map,
				icon: "/geolocation-icon.png"
			});
	}
}

/**
 * Turn on the loading screen
 */
function loadingFadeOut(speed)
{
	if ( speed == null ) speed = 1500;
	$(".loading").fadeOut(speed);
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) 
	{
		// Don't fade the logo in on mobile
	}
	else
	{
		$("#logo-container").fadeIn(speed);
	}

	document.getElementById("loading-message-status").innerHTML = "";
}

/**
 * Turn off the loading screen
 */
function loadingFadeIn(speed)
{
	document.getElementById("loading-message-status").innerHTML = "";

	if ( speed == null ) speed = 1500;
	$(".loading").fadeIn(speed);
	if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) 
	{
		// Don't fade the logo in on mobile
	}
	else
	{
		$("#logo-container").fadeOut(speed);
	}
}

/**
 * Display the Lat/Lon on the bottom bar
 * @param {*} pnt 
 */
function displayCoordinates(pnt) 
{
	var lat = pnt.lat();
	lat = lat.toFixed(4);
	var lng = pnt.lng();
	lng = lng.toFixed(4);
	document.getElementById("latlon-display").innerHTML = lat + ", " + lng;
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
		$.getJSON("https://apachecounty.org/sheriff/edit-history/" + parcel, function (data)
		{
			renderModalProperty(info_box, "Situs", data.situs);

			if ( data.edits.length > 0 )
			{
				var edit_history_html = "<ul>";
				for ( var i = 0; i < data.edits.length; i++ )
				{
					edit_history_html += "<li>" + data.edits[i] + "</li>";
				}
				edit_history_html += "</ul>";
				renderModalProperty(info_box, "Edits", edit_history_html);
			}
		});
	}

	document.getElementById("button-link-assessor").href = "http://www.co.apache.az.us/eagleassessor/?account=" + account_number;
	document.getElementById("button-link-treasurer").href = "http://www.co.apache.az.us/eagletreasurer/?account=" + account_number;
	
	$("#parcelModal").modal("show");

	selectFeature(feature);

	function getFireDistrict(parcel)
	{
		var parcel_geom = parcel.getGeometry();
		var parcel_poly = new google.maps.Polygon({
			paths: parcel_geom.getAt(0).getArray(),
		});

		var ret = null;

		$.each( fires, function( index, fire ) {
			var fire_geom = fire.getGeometry();
			var fire_poly = new google.maps.Polygon({
				paths: fire_geom.getAt(0).getArray(),
			});

			if ( google.maps.geometry.poly.containsLocation(getPolygonCenter(parcel_poly), fire_poly) == true )
			{
				ret = fire.getProperty("DISTRICT");
				return;
			}
		});

		return ret;
	}

	function getCon(parcel)
	{
		var parcel_geom = parcel.getGeometry();
		var parcel_poly = new google.maps.Polygon({
			paths: parcel_geom.getAt(0).getArray(),
		});

		var ret = null;

		$.each( cons, function( index, con ) {
			var con_geom = con.getGeometry();
			var con_poly = new google.maps.Polygon({
				paths: con_geom.getAt(0).getArray(),
			});

			if ( google.maps.geometry.poly.containsLocation(getPolygonCenter(parcel_poly), con_poly) == true )
			{
				ret = con.getProperty("CON_NUMBER") + " " + con.getProperty("CON_NAME");
				return;
			}
		});

		return ret;
	}
}

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

/**
 * Draw a label on the map. The contents of the label are the feature's PARCEL_NUM property
 * @param {*} feature 
 */
function labelFeature(label_text, feature, ignore_zoom_restriction, manual_lat_lon)
{
	if ( ignore_zoom_restriction != true && map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD || label_text == null ) return; // Don't show labels when zoomed out so much
	// Place a marker on there
	var geom = feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});

	var lat_lon = manual_lat_lon;
	if ( lat_lon == null ) lat_lon = getPolygonCenter(poly); // Deault to center of Polygon

	var marker = new google.maps.Marker({
	  position: lat_lon,
	  map: map,
	  label: label_text,
	  icon: "blank.png"
	});

	parcel_num_markers.push(marker);

	return marker;
}

/**
 * Change the style of the feature that is selected, and pan to it
 * @param {*} selected_feature 
 */
function selectFeature(selected_feature)
{
	// Style and color the selected feature
	map.data.overrideStyle(selected_feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});

	labelFeature(selected_feature.getProperty('PARCEL_NUM'), selected_feature);

	var geom = selected_feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});
	var center = getPolygonCenter(poly);
	map.panTo(center);

	selected_feature.setProperty('selected', true);
}

/**
 * Get the center of a Polygon. Code found at
 * https://gist.github.com/jeremejazz/9407568
 * @param {*} poly 
 */
function getPolygonCenter(poly) 
{
	var lowx,
		highx,
		lowy,
		highy,
		lats = [],
		lngs = [],
		vertices = poly.getPath();

	for(var i=0; i<vertices.length; i++) {
		lngs.push(vertices.getAt(i).lng());
		lats.push(vertices.getAt(i).lat());
	}

	lats.sort();
	lngs.sort();
	lowx = lats[0];
	highx = lats[vertices.length - 1];
	lowy = lngs[0];
	highy = lngs[vertices.length - 1];
	center_x = lowx + ((highx-lowx) / 2);
	center_y = lowy + ((highy - lowy) / 2);
	return (new google.maps.LatLng(center_x, center_y));
}

/**
 * Jump to a specific Lat/Lon on the map object
 */
function goToLatLon()
{
	var lat_val = parseFloat(document.getElementById("lat").value);
	var lon_val = parseFloat(document.getElementById("lon").value);

	var my_lat_lon = new google.maps.LatLng(lat_val, lon_val);

	map.panTo(my_lat_lon);
	map.setZoom(18);	

	var marker = new google.maps.Marker({
		position: my_lat_lon,
		map: map
	  });
	
	$.each( all_features, function( index, feature ) {
		try
		{
			var geom = feature.getGeometry();
			var poly = new google.maps.Polygon({
				paths: geom.getAt(0).getArray(),
			});

			if ( google.maps.geometry.poly.containsLocation(my_lat_lon, poly) == true )
			{
				if ( document.getElementById("view-parcel-for-lat-lon").checked == true )
				{
					// Show the info
					showFeature(feature);
				}
				else
				{
					// Just highlight the nearest parcel
					map.data.revertStyle();
					map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
				}
			}
		}
		catch(err)
		{
			console.error("Error with " + feature.getProperty('PARCEL_NUM'));
			console.error(err);
		}
	});
}

/**
 * Go to user's current lat lon
 */
function goToUserLatLon()
{
	if ( user_lat_lon == null ) return;

	map.panTo(user_lat_lon);
	map.setZoom(18);
}

var transportations = [];

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host 
 */
function initSpecific(api_host)
{
    loadingFadeIn();

    $.getJSON(api_host + "/transportation/zones/" + transportation_zone + "/roads.json", function (data) 
    {
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
						strokeWeight: 7,
						zIndex: 5
					});
				}
				
                return ({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
					strokeWeight: 7,
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
    });
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
    
    console.log(feature);

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

function showSitusMarkers(number)
{
	for ( var i = 0; i < marker_markers.length; i++ )
	{
		if ( marker_markers[i].getLabel().indexOf(number) >= 0 )
			marker_markers[i].setMap(map);
		else
			marker_markers[i].setMap(null);
	}
}