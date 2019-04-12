/**
 * This module contains functions that help with populating general content on the Map
 * 
 * Requirements
 * 1) Call mapsScaleMilesHack() in document.ready
 * 2) Call initGeoCode() after the map is loaded
 * 
 */

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
function initGeoCode(goTo)
{
	// GeoMarker stuff
	navigator.geolocation.getCurrentPosition((position) => {
		geoInit(position);
		if (goTo) goToUserLatLon();
	});
	
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
function selectFeature(selected_feature, label, doCenter)
{
	if (doCenter == null) doCenter = true;

	// Style and color the selected feature
	map.data.overrideStyle(selected_feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});

	if (label)
		labelFeature(label, selected_feature, true);
	else
		labelFeature(selected_feature.getProperty('PARCEL_NUM'), selected_feature);

	if (doCenter === true) {
		var geom = selected_feature.getGeometry();
		var poly = new google.maps.Polygon({
			paths: geom.getAt(0).getArray(),
		});
		var center = getPolygonCenter(poly);
		map.panTo(center);
	}

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