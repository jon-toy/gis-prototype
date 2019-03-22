/**
 * This file handles general global variables. Not necessarily constants, just globals.
 */

const FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD = 13; // Hide markers below this threshold

var map, GeoMarker; // Google Maps API objects
var geo_json_urls = []; // URLs for all the GeoJSON objects after listing the results from the server.
						// Global so we can access it in callbacks
var all_features = []; // Unreliable on page load. Used for calls to action after page render
var parcel_num_markers = []; // Store references to all markers currently on the page so we can manipulate en masse
var user_lat_lon = null;
var current_parcel_marker = null;
var current_zone = null;
var all_zones = [];