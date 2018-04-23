var map, GeoMarker;
var geo_json_urls = [];
var shown_parcel_on_startup = false;
var all_features = []; // Unreliable on page load. Used for calls to action after page render

function initPage()
{
	// Get GeoJSON list from Data API
	$.get("/get-maps", function(data, status)
	{
		geo_json_urls = [];

		for ( var i = 0; i < data.body.files.length; i++ ) 
		{
			geo_json_urls.push(data.host + "/maps/" + data.body.files[i]);
		}

		initMap(null);
		
		// Load the GeoJSONs
		for ( var i = 0; i < geo_json_urls.length; i++ )
		{
			$.getJSON(geo_json_urls[i], function (data) 
			{
				var selected_feature = null;
				 var features = map.data.addGeoJson(data);
				 $.each( features, function( index, feature ) {
					  if ( feature.getProperty('PARCEL_NUM') == getParam('parcel') )
						{
							viewParcel(feature);
							shown_parcel_on_startup = true;
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

function selectFeature(selected_feature)
{
	// Style and color the selected feature
	map.data.overrideStyle(selected_feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
					
	// Place a marker on there
	var geom = selected_feature.getGeometry();
	var poly = new google.maps.Polygon({
		paths: geom.getAt(0).getArray(),
	});
	new google.maps.Marker({
	  position: polygonCenter(poly),
	  map: map
	});
}

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
			viewParcel(feature);
			shown_parcel_on_startup = true;
			selectFeature(feature);

			return;
		}
	}
}

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
				viewParcel(feature);
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

// Submit Feedback
$(document).ready(function() {
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
  });

function initMap(my_lat_lon) 
{
	if ( my_lat_lon == null ) my_lat_lon = new google.maps.LatLng(33.83199129270437, -109.120958336746);

	map = new google.maps.Map(document.getElementById('map'), {
	  center: my_lat_lon,
	  zoom: 16,
	  fullscreenControl: false
	});
		
	map.data.addListener('mouseover', function(event)
	{
		//document.getElementById('info_dash').innerHTML = event.feature.getProperty('OWNER');
	});

	map.data.addListener('click', function(event) 
	{			
		viewParcel(event.feature);
	});

	setColors();

	map.data.addListener('mouseover', function(event) {
	  map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
	  displayCoordinates(event.latLng);
	  displayParcel(event.feature);
	});

	map.data.addListener('mouseout', function(event) {
	  map.data.revertStyle();
	});
	
	google.maps.event.addListener(map, 'mousemove', function (event) {
	  displayCoordinates(event.latLng);               
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

	function displayCoordinates(pnt) 
	{
		var lat = pnt.lat();
		lat = lat.toFixed(4);
		var lng = pnt.lng();
		lng = lng.toFixed(4);
		document.getElementById("latlon-display").innerHTML = lat + ", " + lng;
	}

	function displayParcel(feature) 
	{
		document.getElementById("parcel-num-display").innerHTML = "Parcel Number: " + feature.getProperty('PARCEL_NUM');
	}
}

function setColors()
{
	// Set colors
	map.data.setStyle(function(feature) {
	  var color = 'gray';
	  return /** @type {google.maps.Data.StyleOptions} */({
		fillColor: color,
		strokeColor: color,
		strokeWeight: 2
	  });
	});
}

function viewParcel(feature)
{	  
	map.data.revertStyle();
	map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'green', strokeColor:'green'});
	
	var parcel = feature.getProperty('PARCEL_NUM');
	var account_number = feature.getProperty('NUMBER');

	var info_box = document.getElementById('parcel_content');
	info_box.innerHTML = "";

	document.getElementById("parcelModalLabel").innerHTML = "Parcel " + parcel;

	renderProperty(info_box, "Parcel", parcel);
	if ( account_number ) renderProperty(info_box, "Eagle Web", '<a target="_blank" href="http://eagleweb.assessor.co.apache.az.us/assessor/taxweb/account.jsp?guest=true&accountNum=' + account_number + '">' + account_number + '</a>')
	renderProperty(info_box, "Description", feature.getProperty('DESCRIPTIO'));
	renderProperty(info_box, "FCV", feature.getProperty('FCV'));
	renderProperty(info_box, "Legal", feature.getProperty('LEGAL'));
	renderProperty(info_box, "Line 1", feature.getProperty('LINE_1'));
	renderProperty(info_box, "Line 2", feature.getProperty('LINE_2'));
	renderProperty(info_box, "Account Number", feature.getProperty('NUMBER'));
	renderProperty(info_box, "Owner", feature.getProperty('OWNER'));
	renderProperty(info_box, "Owner City", feature.getProperty('OWNER_CITY'));
	renderProperty(info_box, "Owner Zip", feature.getProperty('OWNER_ZIP'));
	renderProperty(info_box, "Situs", feature.getProperty('SITUS'));
	renderProperty(info_box, "Size", feature.getProperty('SIZE'));
	renderProperty(info_box, "State", feature.getProperty('STATE'));
	renderProperty(info_box, "Township", feature.getProperty('TOWNSHIP'));
	renderProperty(info_box, "Range", feature.getProperty('RANGE'));
	renderProperty(info_box, "Section No.", feature.getProperty('SEC_NO'));
	
	$("#parcelModal").modal("show");
}

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

function getParam(name)
{
	var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);

	if ( results == null ) return null;

	return results[1] || 0;
}

/** Function to get center of polygon.
	Found at: https://gist.github.com/jeremejazz/9407568
**/
function polygonCenter(poly) {
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