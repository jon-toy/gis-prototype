const FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD = 16; // Hide markers below this threshold

var map, GeoMarker; // Google Maps API objects
var geo_json_urls = []; // URLs for all the GeoJSON objects after listing the results from the server.
						// Global so we can access it in callbacks
var all_features = []; // Unreliable on page load. Used for calls to action after page render
var parcel_num_markers = []; // Store references to all markers currently on the page so we can manipulate en masse

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
	// Get GeoJSON list
	$.get("/get-maps", function(data, status)
	{
		geo_json_urls = [];

		for ( var i = 0; i < data.body.files.length; i++ ) 
		{
			geo_json_urls.push(data.host + "/maps/" + data.body.files[i]);
		}

		// Create the Map object
		initMap(null);
		
		// Load the GeoJSONs
		for ( var i = 0; i < geo_json_urls.length; i++ )
		{
			$.getJSON(geo_json_urls[i], function (data) 
			{
				var selected_feature = null;
				 var features = map.data.addGeoJson(data);
				 $.each( features, function( index, feature ) {
					  if ( feature.getProperty('PARCEL_NUM') == getUrlParam('parcel') )
						{
							showFeature(feature);
							selected_feature = feature;
						}
					});
				all_features = all_features.concat(features);
				
				if ( selected_feature != null ) 
				{
					selectFeature(selected_feature);
				}
			});
		}		
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
		map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
		displayCoordinates(event.latLng);
		displayParcel(event.feature);
	  });

	map.data.addListener('mouseout', function(event) {
		map.data.revertStyle();
	});
	

	// Show modal on click
	map.data.addListener('click', function(event) 
	{			
		showFeature(event.feature);
	});

	// Set colors
	map.data.setStyle(function(feature) {
		var color = 'gray';
		return /** @type {google.maps.Data.StyleOptions} */({
		  fillColor: color,
		  strokeColor: color,
		  strokeWeight: 2
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
		var geoLatLon = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
		
		 var userMarker = new google.maps.Marker({
				position: geoLatLon,
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
	map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
	
	// Feature properties that we need to get in advance
	var parcel = feature.getProperty('PARCEL_NUM');
	var account_number = feature.getProperty('NUMBER');
	var township = feature.getProperty('TOWNSHIP');
	var range = feature.getProperty('RANGE');
	var sec_no = feature.getProperty('SEC_NO');

	var info_box = document.getElementById('parcel_content');
	info_box.innerHTML = "";

	document.getElementById("parcelModalLabel").innerHTML = "Parcel " + parcel;

	renderProperty(info_box, "Parcel", parcel);
	if ( account_number )
	{
		var parcel_info_string = "";

		if ( township ) parcel_info_string += "Township " + township + " ";
		if ( range ) parcel_info_string += "Range " + range + " ";
		if ( sec_no ) parcel_info_string += "Section " + sec_no + " ";

		if ( parcel_info_string.length <= 0 ) parcel_info_string = account_number;

		renderProperty(info_box, "Parcel Information", '<a target="_blank"' + 
			'href="http://eagleweb.assessor.co.apache.az.us/assessor/taxweb/account.jsp?guest=true&accountNum=' +
			account_number + '">' + parcel_info_string + '</a>')
	}

	renderProperty(info_box, "Description", feature.getProperty('DESCRIPTIO'));
	renderProperty(info_box, "FCV", feature.getProperty('FCV'));
	renderProperty(info_box, "Legal", feature.getProperty('LEGAL'));
	renderProperty(info_box, "Line 1", feature.getProperty('LINE_1'));
	renderProperty(info_box, "Line 2", feature.getProperty('LINE_2'));
	//renderProperty(info_box, "Account Number", feature.getProperty('NUMBER')); // No need to get the account number
	renderProperty(info_box, "Owner", feature.getProperty('OWNER'));
	renderProperty(info_box, "Owner City", feature.getProperty('OWNER_CITY'));
	renderProperty(info_box, "Owner Zip", feature.getProperty('OWNER_ZIP'));
	renderProperty(info_box, "Situs", feature.getProperty('SITUS'));
	renderProperty(info_box, "Size", feature.getProperty('SIZE'));
	renderProperty(info_box, "State", feature.getProperty('STATE'));
	
	$("#parcelModal").modal("show");

	selectFeature(feature);

	function renderProperty(container, title, content)
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

		container.appendChild(row);
	}
}

/**
 * Draw a label on the map. The contents of the label are the feature's PARCEL_NUM property
 * @param {*} feature 
 */
function labelFeature(feature)
{
	if ( map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD ) return; // Don't show labels when zoomed out so much
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
 * Handler for Search By Parcel Number box. Loops through collection of all features and
 * checks if the value in the box matches with any Parcel Numbers (exact match).
 */
function onSearchByParcelNo()
{
	event.preventDefault();
	var parcel_num = document.getElementById("search-by-parcel-number").value;
	if ( parcel_num == null || parcel_num.length <= 0 ) return;

	for ( var i = 0; i < all_features.length; i++ ) 
	{
		var feature = all_features[i];
		
		if ( feature.getProperty('PARCEL_NUM') == parcel_num )
		{
			showFeature(feature);

			return;
		}
	}
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
	
	$.each( all_features, function( index, feature ) {
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
	});

	var marker = new google.maps.Marker({
		position: my_lat_lon,
		map: map
	  });
}