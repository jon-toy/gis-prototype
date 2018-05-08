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

$(document).ready(function() {
	initFeedback();
  });

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
 * Called by Google Maps API after its loaded. Makes a call out to the server to get a list
 * of the GeoJSONs, then calls out to the data API to grab the GeoJSONs individually and
 * load them asynchonously
 */
function initPage()
{
	var zone_num = getUrlParam("zone_num");

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
		initMap(null);

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
					$(".loading").fadeOut(1500);
					if( /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ) 
					{
						// Don't fade the logo in on mobile
					}
					else
					{
						$("#logo-container").fadeIn(1500);
					}

					console.log("Total Parcels: " + all_features.length);
				}
				else
				{
					document.getElementById("loading-message-status").innerHTML = "Loading Parcel Data (" + load_completed.length + " of " + geo_json_urls.length + ")..."
				}
			});
		}	
	});

	$('#search-by-parcel-number-button').click(function(event) {

        // Stop the Search input reloading the page by preventing its default action
		event.preventDefault();
		
		onSearchByParcelNo();
	});

	/**
	 * Handler for Search By Parcel Number box. Loops through collection of all features and
	 * checks if the value in the box matches with any Parcel Numbers (exact match).
	 */
	function onSearchByParcelNo()
	{
		var parcel_num = document.getElementById("search-by-parcel-number").value;
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

				return;
			}
		}
	}
}

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

/**
 * Create the map object and set up the listeners
 * @param {*} my_lat_lon 
 */
function initMap(my_lat_lon) 
{
	if ( my_lat_lon == null ) my_lat_lon = new google.maps.LatLng(33.83199129270437, -109.120958336746); // Starting position
	;

	map = new google.maps.Map(document.getElementById('map'), {
	  center: my_lat_lon,
	  zoom: FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD,
	  fullscreenControl: false
	});

	// Highlight the parcels
	map.data.addListener('mouseover', function(event) {
		var color = '#28a745';
		map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:color, strokeColor:color});
		displayCoordinates(event.latLng);
		displayParcel(event.feature);

		current_parcel_marker = labelFeature(event.feature, true);
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
	 * Display the Parcel Number on the bottom bar
	 * @param {*} feature 
	 */
	function displayParcel(feature) 
	{
		document.getElementById("parcel-num-display").innerHTML = "Parcel Number: " + feature.getProperty('PARCEL_NUM');
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
function labelFeature(feature, ignore_zoom_restriction)
{
	if ( ignore_zoom_restriction != true && map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD ) return; // Don't show labels when zoomed out so much
	// Place a marker on there
	var geom = feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});

	var center = getPolygonCenter(poly);

	var marker = new google.maps.Marker({
	  position: center,
	  map: map,
	  label: feature.getProperty('PARCEL_NUM'),
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

	labelFeature(selected_feature);

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

function jumpToUserLatLon()
{
	if ( user_lat_lon == null ) return;

	map.panTo(user_lat_lon);
	map.setZoom(18);
}