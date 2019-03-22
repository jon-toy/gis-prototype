var click_listener = null;
var measure_overlay = null;

$(document).ready(function() {
	initFeedback();
	initParcelParam();

	$('#search-by-parcel-number-button').click(function(event) {

        // Stop the Search input reloading the page by preventing its default action
		event.preventDefault();
		
		searchByParcelNumLoadZone();
	});

	mapsScaleMilesHack();

  });

function initParcelParam()
{
	// Get the parcel
	var parcel_num_param = getUrlParam("parcel");
	if ( parcel_num_param == null ) return;

	$("#select-mode-inner").hide();
	searchByParcelNumLoadZone(parcel_num_param, true)
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
			$("#select-mode-inner").hide();

			showFeature(feature);
			selectFeature(feature);
			
			// Zoom in
			map.setZoom(14);
			return;
		}
	}
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
 * After Maps API is loaded, await user input
 */
function initModeSelect()
{

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
		zoom: 8,
		fullscreenControl: false,
		scaleControl: true,
		gestureHandling: 'greedy'
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
		$('#navbar-title').html(event.feature.getProperty("ZONE_NAME") + " Parcel Viewer");
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

		all_zones = []; // Load the fresh zones

		for ( var i = 0; i < zones.length; i++ ) 
		{
			labelFeature(zones[i].getProperty('ZONE_NAME'), zones[i], true);
			all_zones.push(zones[i]);
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

function getFeatureStyle(clickable)
{
	return function(feature) {
		var color = '#007bff';

		// Change the color of the feature permanently
		if (feature.getProperty('selected')) 
		{
			color = '#20c997';
		}

		return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			strokeColor: color,
			strokeWeight: 1,
			clickable: clickable,
			fillOpacity: 0.1
			});
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
		click_listener = map.data.addListener('click', function(event) 
		{			
			showFeature(event.feature);
			
			event.feature.setProperty('selected', true);
		});

		// Set colors
		map.data.setStyle(getFeatureStyle(true));

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
		
		var load_completed = [];
		// Load the GeoJSONs
		for ( var i = 0; i < geo_json_urls.length; i++ )
		{
			$.getJSON(geo_json_urls[i], function (data) 
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

				load_completed.push(true);

				if ( load_completed.length == geo_json_urls.length ) 
				{
					loadingFadeOut();
					current_zone = zone_num;
					if ( current_zone == null ) current_zone = 'all';
					if ( callback ) callback();
				}
				else
				{
					document.getElementById("loading-message-status").innerHTML = "Loading Parcel Data (" + load_completed.length + " of " + geo_json_urls.length + ")..."
				}
			});
		}	

		mapsScaleMilesHack();
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

	// Remove account balance
	/*if ( account_number )
	{
		$.getJSON("https://apachecounty.org/treasurer/account-balance/" + account_number, function (data)
		{
			var with_decimal = data.balance_due.substring(0, data.balance_due.length - 2) + '.' + data.balance_due.substring(data.balance_due.length - 2, data.balance_due.length);

			renderModalProperty(info_box, "Balance Due", "$" + with_decimal);
		});
	}*/

	document.getElementById("button-link-assessor").href = "https://www.co.apache.az.us/eagleassessor/?account=" + account_number;
	document.getElementById("button-link-treasurer").href = "https://www.co.apache.az.us/eagletreasurer/?account=" + account_number;
	
	$("#parcelModal").modal("show");

	selectFeature(feature);
}

function goToZone(zone_num)
{
	if ( zone_num == 'select') return initZones();

	$("#select-mode-inner").hide();
	$('#navbarSupportedContent').collapse('hide');

	$('#navbar-title').html(getZoneName(zone_num) + " Parcel Viewer");

	return initParcels(zone_num);
}

function getZoneName(zone_num)
{
	if ( zone_num == null ) return "Apache County";

	// Get the zones if we haven't already
	if ( all_zones.length == 0 )
	{
		$.getJSON("https://apachecounty.org/zones/zones.json", function (data) 
		{
			var buffer = new google.maps.Data();
			var zones = buffer.addGeoJson(data);

			all_zones = []; // Load the fresh zones

			// Suboptimal but we should only ever have like 10 zones anyway
			for ( var i = 0; i < zones.length; i++ ) 
			{
				all_zones.push(zones[i]);
			}

			for ( var i = 0; i < all_zones.length; i++ )
			{
				if ( all_zones[i].getProperty("ZONE") == zone_num ) 
				{
					$('#navbar-title').html(all_zones[i].getProperty("ZONE_NAME") + " Parcel Viewer");
					$('#confirmZoneModalNewZone').html(all_zones[i].getProperty("ZONE_NAME"));

					return; // Return nothing since we've already changed it. Workaround since this is done in a callback function
				}
			}
		});
	}
	else
	{
		for ( var i = 0; i < all_zones.length; i++ )
		{
			if ( all_zones[i].getProperty("ZONE").toString() == zone_num.toString() ) return all_zones[i].getProperty("ZONE_NAME");
		}
	}

	return "Apache County";
}