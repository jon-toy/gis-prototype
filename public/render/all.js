const FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD = 16; // Hide markers below this threshold

var map, GeoMarker; // Google Maps API objects
var geo_json_urls = []; // URLs for all the GeoJSON objects after listing the results from the server.
						// Global so we can access it in callbacks
var all_features = []; // Unreliable on page load. Used for calls to action after page render
var parcel_num_markers = []; // Store references to all markers currently on the page so we can manipulate en masse
var cons = [];
var fires = [];
var user_lat_lon = null;
var current_parcel_marker = null;
var current_zone = null;

$(document).ready(function() {
	initFeedback();
	initParcelParam();

	$('#search-by-parcel-number-button').click(function(event) {

        // Stop the Search input reloading the page by preventing its default action
		event.preventDefault();
		
		searchByParcelNumLoadZone();
	});
  });

function initParcelParam()
{
	// Get the parcel
	var parcel_num_param = getUrlParam("parcel");
	if ( parcel_num_param == null ) return;

	$("#select-mode-inner").hide();
	searchByParcelNumLoadZone(parcel_num_param)
}

/**
 * Search for a parcel, given a parcel. If the parcel is outside the currently loaded zone, load it
 * @param {} parcel_num 
 */
function searchByParcelNumLoadZone(parcel_num)
{
	if ( parcel_num == null ) parcel_num = document.getElementById("search-by-parcel-number").value;

	var uri = "https://apachecounty.org/parcels/" + parcel_num;
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

			if ( current_zone == data.zone )
			{
				// No need to load the zone again, just pan to the parcel
				getParcelFromMap(feature.getProperty("PARCEL_NUM"));
				return;
			}
			
			initParcels(data.zone, starting_lat_lon, function()
			{
				getParcelFromMap(feature.getProperty("PARCEL_NUM"));
			});
		});
	});

/**
 * Get the feature/parcel from the map, given a parcel number
 * @param {} parcel_num 
 */
function getParcelFromMap(parcel_num)
{
	if ( parcel_num == null ) parcel_num = document.getElementById("search-by-parcel-number").value;
	if ( parcel_num == null || parcel_num.length <= 0 ) return;

	for ( var i = 0; i < all_features.length; i++ ) 
	{
		var feature = all_features[i];

		// Sanitize the input value
		var sanitized_input = parcel_num.replace('-', '');
		while ( sanitized_input.indexOf('-') >= 0 )
		{
			sanitized_input = sanitized_input.replace('-', ''); // Search ignores hyphens
		}
		sanitized_input = sanitized_input.toUpperCase(); // Search ignores case

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
			showFeature(feature);
			selectFeature(feature);
			return;
		}
	}
}
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
 * 
 */
function selectMode(mode)
{
	$("#select-mode-inner").hide();

	if ( mode == 0 ) return initZones();
	if ( mode == 1 ) return initParcels();
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
 * After Maps API is loaded, await user input
 */
function initModeSelect()
{
	/*var starting_lat_lon = new google.maps.LatLng(34.600, -109.450); // Starting position
	map = new google.maps.Map(document.getElementById('map'), {
		center: starting_lat_lon,
		zoom: 9,
		fullscreenControl: false
	  });*/
}

/**
 * Load a map displaying the zones. Click on a zone to call initParcels(zone) and load only the
 * parcels in that zone
 */
function initZones()
{
	loadingFadeIn(100);

	var starting_pos = new google.maps.LatLng(35.330, -109.450); // Starting position

	// Create the Map object
	map = new google.maps.Map(document.getElementById('map'), {
		center: starting_pos,
		zoom: 8, //8.9,
		fullscreenControl: false,
	});

	// Highlight the parcels
	map.data.addListener('mouseover', function(event) {
		var color = getColorByZone(event.feature.getProperty("ZONE"));
		map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:color, strokeColor:color});
		displayCoordinates(event.latLng);
	});

	map.data.addListener('mouseout', function(event) {
		map.data.revertStyle();
	});
	

	// Show modal on click
	map.data.addListener('click', function(event) 
	{			
		loadingFadeIn();
		var zone = event.feature.getProperty("ZONE");
		initParcels(zone);
	});

	// Set colors
	map.data.setStyle(function(feature) {
		return /** @type {google.maps.Data.StyleOptions} */({
		fillColor: getColorByZone(feature.getProperty("ZONE")),
		strokeColor: '#000000',
		strokeWeight: 3
		});
	});

	// Populate the Lat Lon. Separate from the mouseover so we keep track outside the parcels
	google.maps.event.addListener(map, 'mousemove', function (event) {
		displayCoordinates(event.latLng);               
	});

	map.addListener('zoom_changed', function() {

	});

	initGeoCode();

	// Load the Zone GeoJSON
	$.getJSON("https://apachecounty.org/zones/zones.json", function (data) 
	{
		var zones = map.data.addGeoJson(data);

		for ( var i = 0; i < zones.length; i++ ) 
		{
			/*if ( zones[i].getProperty('ZONE') == 1 )
			{
				var lat_lon = new google.maps.LatLng(35.18, -109.43913149999997);
				labelFeature(zones[i].getProperty('ZONE_NAME'), zones[i], true, lat_lon);
			}
			else if ( zones[i].getProperty('ZONE') == 7 )
			{
				var lat_lon = new google.maps.LatLng(34.02, -109.45805050000001);
				labelFeature(zones[i].getProperty('ZONE_NAME'), zones[i], true, lat_lon);
			}
			else*/
			{
				labelFeature(zones[i].getProperty('ZONE_NAME'), zones[i], true);
			}
		}

		loadingFadeOut();
	});

	function getColorByZone(zone_num)
	{
		var color = "#007bff";

		switch(zone_num)
		{
			case 1:
				color = '#007bff';
				break;
			case 2:
				color = '#dc3545';
				break;
			case 3:
				color = '#ffc107';
				break;
			case 4:
				color = '#28a745';
				break;
			case 5:
				color = '#6610f2';
				break;
			case 6:
				color = '#6c757d';
				break;
			case 7:
				color = '#fd7e14';
				break;
			default:
		}

		return color;
	}
}

/**
 * Load a map displaying the parcels. Click on a parcel to display info. If a zone number is provided,
 * load only the parcels in that zone. If not, load ALL the parcels
 * @param {*} zone_num 
 */
function initParcels(zone_num, starting_lat_lon, callback)
{
	loadingFadeIn();

	var uri = "/get-maps";
	if ( zone_num ) uri += "?zone_num=" + zone_num;

	// Get GeoJSON list
	$.get(uri, function(data, status)
	{
		geo_json_urls = [];
		var api_host = data.host;
		for ( var i = 0; i < data.body.books.length; i++ ) 
		{
			geo_json_urls.push(data.host + "/books/" + data.body.books[i]);
		}

		// Create the Map object
		if ( starting_lat_lon == null && data.body.starting_lat && data.body.starting_lon ) starting_lat_lon = new google.maps.LatLng(data.body.starting_lat, data.body.starting_lon);
		var starting_zoom = data.body.starting_zoom;

		if ( starting_lat_lon == null ) starting_lat_lon = new google.maps.LatLng(33.83199129270437, -109.120958336746); // Starting position
		if ( starting_zoom == null ) starting_zoom = FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD;

		map = new google.maps.Map(document.getElementById('map'), {
		center: starting_lat_lon,
		zoom: starting_zoom,
		fullscreenControl: false
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
		});

		// Set colors
		map.data.setStyle(function(feature) {
			var color = '#007bff';
			return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			strokeColor: color,
			strokeWeight: 3
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
		
		var load_completed = [];
		// Load the GeoJSONs
		for ( var i = 0; i < geo_json_urls.length; i++ )
		{
			$.getJSON(geo_json_urls[i], function (data) 
			{
				var selected_feature = null;
				try
				{
					var features = map.data.addGeoJson(data);
					if ( getUrlParam('parcel') != null ) 
					{
						$.each( features, function( index, feature ) {
							if ( feature.getProperty('PARCEL_NUM') == getUrlParam('parcel') )
								{
									showFeature(feature);
									selected_feature = feature;
								}
							});
					}
					all_features = all_features.concat(features);
					
					if ( selected_feature != null ) 
					{
						selectFeature(selected_feature);
					}
				}
				catch(err)
				{
					console.log(err);
				}

				load_completed.push(true);

				if ( load_completed.length == geo_json_urls.length ) 
				{
					loadingFadeOut();
					current_zone = zone_num;
					if ( callback ) callback();
					console.log("Total Parcels: " + all_features.length);
				}
				else
				{
					document.getElementById("loading-message-status").innerHTML = "Loading Parcel Data (" + load_completed.length + " of " + geo_json_urls.length + ")..."
				}
			});
		}	
	});

	/**
	 * Display the Parcel Number on the bottom bar
	 * @param {*} feature 
	 */
	function displayParcel(feature) 
	{
		document.getElementById("parcel-num-display").innerHTML = "Parcel Number: " + feature.getProperty('PARCEL_NUM');
	}

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

	renderProperty(info_box, "Situs", feature.getProperty('SITUS'));
	renderProperty(info_box, "CON", getCon(feature));
	renderProperty(info_box, "Fire District", getFireDistrict(feature));
	if ( show_mid_bar == true ) renderProperty(info_box, "", "", "border-top my-3");
	renderProperty(info_box, "Owner", owner);
	renderProperty(info_box, "Account Information", account_number);
	renderProperty(info_box, "Size", size);

	document.getElementById("button-link-assessor").href = "http://www.co.apache.az.us/eagleassessor/?account=" + account_number;
	document.getElementById("button-link-treasurer").href = "http://www.co.apache.az.us/eagletreasurer/?account=" + account_number;
	
	$("#parcelModal").modal("show");

	selectFeature(feature);

	function renderProperty(container, title, content, css_classes)
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

function goToZone(zone_num)
{
	if ( zone_num == 'select') return initZones();

	$("#select-mode-inner").hide();
	$('#navbarSupportedContent').collapse('hide');
	return initParcels(zone_num);
}