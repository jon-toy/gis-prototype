/**
 * This module contains general helper functions for general use amongst all pages
 * 
 * Requirements
 * None, really. The functions should be self-sufficient/static, so use them as needed!
 * 
 */

 /**
 * Modal stuff
 */
$(document).on('show.bs.modal', '.modal', function () {
    var zIndex = 1040 + (10 * $('.modal:visible').length);
    $(this).css('z-index', zIndex);
    setTimeout(function() {
        $('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
    }, 0);
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
 * Display the Parcel Number on the bottom bar
 * @param {*} feature 
 */
function displayParcel(feature) 
{
	document.getElementById("parcel-num-display").innerHTML = "Parcel Number: " + feature.getProperty('PARCEL_NUM');
}

/**
 * Display the Owner on the bottom bar
 * @param {*} feature 
 */
function displayOwner(feature) 
{
	document.getElementById("parcel-num-display").innerHTML = "Owner: " + feature.getProperty('OWNER');
}

/**
 * Display the Marker on the bottom bar
 * @param {*} feature 
 */
function displayMarker(feature) 
{
	document.getElementById("parcel-num-display").innerHTML = "Address: " + feature.getProperty('NUMBER1') + " " + feature.getProperty('NUMBER0');
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
 * Store a compressed string into localStorage. Perform error handling too
 */
function localStorageSetItem(key, valueAsString) {
	try {
		// Take the string and compress it
		var compressedString = LZString.compressToUTF16(valueAsString);

		localStorage.setItem(key, compressedString);
	}
	catch (e) {
		console.log(e);
	}
}


// "Constants" for Local Storage Keys
var LOCAL_STORAGE_KEY_META_DATA = "meta-data";
var LOCAL_STORAGE_KEY_ZONE_FLAG = "zone";
var LOCAL_STORAGE_KEY_MARKERS =  "markers";
var LOCAL_STORAGE_KEY_PARCELS =  "parcels";
var LOCAL_STORAGE_KEY_ROADS =  "roads";
var LOCAL_STORAGE_KEY_TEXT =  "text";

var load_from_local_storage = {
	parcels: true,
	markers: true,
	roads: true,
	text: true
}

/**
 * Get an item from localStorage, uncompress and return as an Object. If not found, return null
 * @param {*} key 
 */
function localStorageGetItemAsObject(key) {
	try {
		var obj = JSON.parse(localStorageGetItemAsString(key));
		return obj;
	}
	catch (e) {
		console.log(e);
	}

	return null;
}

/**
 * Get an item from localStorage, uncompress and return as a String. If not found, return null
 * @param {*} key 
 */
function localStorageGetItemAsString(key) {
	var compressedString = null;
	try {
		compressedString = localStorage.getItem(key);

		if (compressedString == null) return null;

		// Uncompress the string
		var uncompressedString = LZString.decompressFromUTF16(compressedString);
		return uncompressedString;
	}
	catch (e) {
		console.log(e);
	}
	 
	return null;
}