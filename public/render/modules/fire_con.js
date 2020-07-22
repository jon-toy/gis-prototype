/**
 * This module contains the AJAX calls to populate the fire and con collections. These can be used to
 * provide fire and con data for a parcel.
 *
 * Requirements
 * 1) Call initFireCon() while loading parcels
 *
 */

var cons = [];
var fires = [];

/**
 * Grab cons and fire GeoJSONs to load them specially into memory
 * @param {} api_host
 */
function initFireCon(api_host) {
  var buffer = new google.maps.Data();

  $.getJSON(api_host + "/sheriff/con.json", function (data) {
    cons = buffer.addGeoJson(data);
  });

  $.getJSON(api_host + "/sheriff/fire.json", function (data) {
    fires = buffer.addGeoJson(data);
  });
}

function getFireDistrict(parcel) {
  var parcel_geom = parcel.getGeometry();
  var parcel_poly = new google.maps.Polygon({
    paths: parcel_geom.getAt(0).getArray(),
  });

  var ret = null;

  $.each(fires, function (index, fire) {
    var fire_geom = fire.getGeometry();
    var fire_poly = new google.maps.Polygon({
      paths: fire_geom.getAt(0).getArray(),
    });

    if (
      google.maps.geometry.poly.containsLocation(
        getPolygonCenter(parcel_poly),
        fire_poly
      ) == true
    ) {
      ret = fire.getProperty("DISTRICT");
      return;
    }
  });

  return ret;
}

function getCon(parcel) {
  var parcel_geom = parcel.getGeometry();
  if (!parcel_geom || !parcel_geom.getAt(0)) return "";
  var parcel_poly = new google.maps.Polygon({
    paths: parcel_geom.getAt(0).getArray(),
  });

  var ret = null;

  $.each(cons, function (index, con) {
    var con_geom = con.getGeometry();
    var con_poly = new google.maps.Polygon({
      paths: con_geom.getAt(0).getArray(),
    });

    if (
      google.maps.geometry.poly.containsLocation(
        getPolygonCenter(parcel_poly),
        con_poly
      ) == true
    ) {
      ret = con.getProperty("CON_NUMBER") + " " + con.getProperty("CON_NAME");
      return;
    }
  });

  return ret;
}
