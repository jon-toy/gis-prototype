/**
 * This module contains general helper functions for general use amongst all pages
 * 
 * Requirements
 * None, really. The functions should be self-sufficient/static, so use them as needed!
 * 
 */

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