/**
 * A reduced form of the Rural Address Viewer:
 * - Shows an empty map with current user location
 * - Can search for a parcel and display the SITUS for it
 */

const api_host = "https://apachecounty.org";

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = [
  "south",
  "vernon",
  "north",
  "east",
  "concho",
  "springervilleeagar",
];
var transportation_zones_starting_points = [
  { lat: 33.9513, lon: -109.2292 },
  { lat: 34.3693, lon: -109.7816 },
  { lat: 35.1159, lon: -109.5619 },
  { lat: 34.6607, lon: -109.192 },
  { lat: 34.5180075, lon: -109.69512700000001 },
  { lat: 34.1096, lon: -109.2906 },
];

var transportations = [];

// Only show valid zones
var trans_zone_index = valid_transportation_zones.indexOf(transportation_zone);
if (trans_zone_index < 0) {
  transportation_zone = valid_transportation_zones[0];
  trans_zone_index = 0;
}

var trans_zone_starting_point =
  transportation_zones_starting_points[trans_zone_index];
var user_lat_lon, user_marker;
var viewedFeature;
var bounds = {};
var markers = [];
var text = [];
var marker_markers = [];
var marker_markers_origin = [];
var currentMarkersForRoad = null;
var trans_zone_starting_point_zoom = 15;

$(document).ready(function () {
  initFeedback();

  mapsScaleMilesHack();
  initLastModified();
});

function mapCallback() {
  var loadConfig = {
    disableParcels: true,
    disableMarkers: false,
    disableRoads: false,
    disableText: false,
    continueLoadingTextCustom: (data) => continueLoadingTextCustom(data),
    continueLoadingMarkersCustom: (data) => continueLoadingMarkersCustom(data),
    preParcelCallback: () => initParcelParam(),
  };

  initCacheLoad(loadConfig);

  initSearchModal(transportation_zone);

  // initSearchModal(transportation_zone);
  // goToUserLatLon();
  // initParcelParam();
  //initFireTruckGeoCode();
}

function continueLoadingMarkersCustom(data) {
  //Add to a buffer since we don't actually want to render markers, just get their origin points
  var buffer = new google.maps.Data();
  markers = buffer.addGeoJson(data);
  buffer = null; // Clear the buffer
}

function continueLoadingTextCustom(data) {
  var buffer = new google.maps.Data();
  text = buffer.addGeoJson(data);
  buffer = null;
}

async function populateOriginMarkers() {
  for (var i = 0; i < markers.length; i++) {
    var marker = new google.maps.Marker({
      position: markers[i].getGeometry().getAt(0), // Origin point
      label: {
        text: markers[i].getProperty("NUMBER0"),
        color: "black",
        fontSize: "20px",
        fontWeight: "bold",
      },
      title: markers[i].getProperty("NUMBER"), // Store parcel number in marker for easier lookup
      map: null,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
    });
    marker_markers_origin.push(marker);
  }
}

async function populateHouseMarkers() {
  for (var i = 0; i < text.length; i++) {
    var houseNumber = text[i].getProperty("TEXTSTRING");
    if (houseNumber.indexOf(" ") >= 0) houseNumber = houseNumber.split(" ")[0]; // Just show houseNumber
    // Create a label
    var marker = new google.maps.Marker({
      position: text[i].getGeometry().get(),
      label: {
        text: houseNumber,
        color: "black",
        fontSize: "20px",
        fontWeight: "bold",
      },
      title: text[i].getProperty("TEXTSTRING"),
      map: null,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 0,
      },
    });
    markers.push(text[i]);
    marker_markers.push(marker);
  }
}

function initParcelParam() {
  // Get the parcel
  var parcel_num_param = getUrlParam("parcel");
  if (parcel_num_param == null) return;

  $("#select-mode-inner").hide();
  getParcelFromMap(parcel_num_param, false);
}

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host
 */
function initSpecific(api_host) {
  loadingFadeIn();

  // Set colors
  map.data.setStyle(function (feature) {
    // Transporation
    if (transportations.indexOf(feature) >= 0) {
      if (feature.getProperty("selected")) {
        return {
          strokeColor: "'#20c997'",
          strokeWeight: 5,
          zIndex: 5,
        };
      }

      return {
        strokeColor: "#FF0000",
        strokeOpacity: 0.3,
        strokeWeight: 5,
        zIndex: 5,
      };
    }

    // Parcels
    var color = "#007bff";

    // Change the color of the feature permanently
    if (feature.getProperty("selected")) {
      color = "#20c997";
    }

    if (feature.getProperty("marker")) {
      color = "#993300";
    }

    return /** @type {google.maps.Data.StyleOptions} */ ({
      fillColor: "white",
      fillOpacity: 0.3,
      strokeColor: color,
      strokeWeight: 8,
    });
  });

  // Remove all listeners
  google.maps.event.clearListeners(map.data, "click");
  google.maps.event.clearListeners(map.data, "mouseover");

  // Show modal on click
  map.data.addListener("click", function (event) {
    for (var i = 0; i < transportations.length; i++)
      transportations[i].setProperty("selected", false);

    event.feature.setProperty("selected", true);

    // Transporation
    if (transportations.indexOf(event.feature) >= 0) {
      var number = event.feature.getProperty("NUMBER");
      if (currentMarkersForRoad != number) showSitusMarkers(number);
      else hideSitusMarkers();
      return showTransportation(event.feature);
    }

    showFeature(event.feature);
  });

  // Mouse over
  map.data.addListener("mouseover", function (event) {
    var color = "#28a745";
    map.data.overrideStyle(event.feature, {
      strokeWeight: 8,
      fillColor: color,
      strokeColor: color,
    });
    displayCoordinates(event.latLng);

    if (transportations.indexOf(event.feature) >= 0) {
      displayTransportation(event.feature);
    } else if (markers.indexOf(event.feature) >= 0) {
      displayMarker(event.feature);
    }

    current_parcel_marker = labelFeature(
      event.feature.getProperty("situs"),
      event.feature,
      true
    );
  });

  // Change color based on which terrain is set
  map.addListener("maptypeid_changed", function () {
    var typeToColor, type, color, k, label;

    typeToColor = {
      terrain: "black",
      roadmap: "black",
      hybrid: "white",
      satellite: "white",
    };

    type = map.getMapTypeId();
    color = typeToColor[type];

    for (k in marker_markers) {
      if (marker_markers.hasOwnProperty(k)) {
        label = marker_markers[k].getLabel();
        label.color = color;
        marker_markers[k].setLabel(label);
      }
    }

    for (k in marker_markers_origin) {
      if (marker_markers_origin.hasOwnProperty(k)) {
        label = marker_markers_origin[k].getLabel();
        label.color = color;
        marker_markers_origin[k].setLabel(label);
      }
    }
  });

  loadingFadeOut();
}

/**
 * Display the Transportation on the bottom bar
 * @param {*} feature
 */
function displayTransportation(feature) {
  document.getElementById("parcel-num-display").innerHTML =
    "Road: " + feature.getProperty("NUMBER");
}

/**
 * Parse out properties from the transportation feature, place those properties into the Transportation Modal,
 * and show it.
 * @param {*} feature
 */
function showTransportation(feature) {
  map.data.revertStyle();
  map.data.overrideStyle(feature, {
    strokeWeight: 8,
    fillColor: "blue",
    strokeColor: "blue",
  });

  var info_box = document.getElementById("transportation_content");
  info_box.innerHTML = "";

  document.getElementById("transportationModalLabel").innerHTML =
    "Road " + feature.getProperty("NUMBER");

  renderModalProperty(info_box, "Number 0", feature.getProperty("NUMBER0"));
  renderModalProperty(info_box, "Road Name", feature.getProperty("ROAD_NAME"));
  renderModalProperty(info_box, "Number 1", feature.getProperty("NUMBER1"));

  //$("#transportationModal").modal("show");

  selectFeature(feature);

  function renderModalProperty(container, title, content, css_classes) {
    if (content == null) return;

    var row = document.createElement("div");
    row.className = "row p-2";

    var title_container = document.createElement("div");
    title_container.className = "col-3";
    title_container.innerHTML = "<b>" + title + "</b>";
    row.appendChild(title_container);

    var content_container = document.createElement("div");
    content_container.className = "col-9";
    content_container.innerHTML = content;
    row.appendChild(content_container);

    if (css_classes) row.className = css_classes;

    container.appendChild(row);
  }
}

function showSitusMarkers(number) {
  for (var i = 0; i < text.length; i++) {
    if (
      text[i]
        .getProperty("TEXTSTRING")
        .toUpperCase()
        .indexOf(number.toUpperCase()) >= 0
    ) {
      var houseNumber = text[i].getProperty("TEXTSTRING");
      if (houseNumber.indexOf(" ") >= 0)
        houseNumber = houseNumber.split(" ")[0]; // Just show houseNumber
      // Create a label
      var marker = new google.maps.Marker({
        position: text[i].getGeometry().get(),
        label: {
          text: houseNumber,
          color: "black",
          fontSize: "20px",
          fontWeight: "bold",
        },
        title: text[i].getProperty("TEXTSTRING"),
        map: null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
      });
      markers.push(text[i]);
      marker_markers.push(marker);
    }
  }
  for (var i = 0; i < marker_markers.length; i++) {
    if (
      marker_markers[i]
        .getTitle()
        .toUpperCase()
        .indexOf(number.toUpperCase()) >= 0
    )
      marker_markers[i].setMap(map);
    else marker_markers[i].setMap(null);
  }

  currentMarkersForRoad = number;
}

function hideSitusMarkers() {
  for (var i = 0; i < marker_markers.length; i++) {
    marker_markers[i].setMap(null);
  }
  currentMarkersForRoad = null;
}

/**
 * Get the feature/parcel from the map, given a parcel number
 * @param {} parcel_num
 */
function getParcelFromMap(parcel_num, doCenter, zoomValue) {
  if (parcel_num == null)
    parcel_num = document.getElementById("search-by-parcel-number").value;
  if (parcel_num == null || parcel_num.length <= 0) return;

  // Sanitize the input value
  var sanitized_input = parcel_num.replace("-", "");
  while (sanitized_input.indexOf("-") >= 0) {
    sanitized_input = sanitized_input.replace("-", ""); // Search ignores hyphens
  }
  sanitized_input = sanitized_input.toUpperCase(); // Search ignores case

  // Get from API
  $.getJSON(api_host + "/parcels/" + sanitized_input, function (data) {
    // Add to map
    var feature = map.data.addGeoJson(data);

    // Show it
    $("#select-mode-inner").hide();

    showFeature(feature[0], doCenter, true);
    viewedFeature = feature[0];

    var geom = viewedFeature.getGeometry();
    var poly = new google.maps.Polygon({
      paths: geom.getAt(0).getArray(),
    });

    map.setCenter(getPolygonCenter(poly));

    // Zoom in
    if (zoomValue) map.setZoom(zoomValue);

    // Satellite View
    //map.setMapTypeId("hybrid"); // Disable at request of the chief, leaving in in case they change their minds
    return;
  });
}

/**
 * Parse out properties from the feature, place those properties into the Parcel Modal,
 * and show it.
 * @param {*} feature
 */
function showFeature(feature, doCenter, hideModal) {
  if (doCenter == null) doCenter = true;
  map.data.revertStyle();
  map.data.overrideStyle(feature, {
    strokeWeight: 8,
    fillColor: "blue",
    strokeColor: "blue",
  });

  // Feature properties that we need to get in advance
  var parcel = feature.getProperty("PARCEL_NUM");
  document.getElementById("parcelModalLabel").innerHTML = parcel;
  var owner = feature.getProperty("OWNER");

  var info_box = document.getElementById("parcel_content");
  info_box.innerHTML = "";

  renderModalProperty(info_box, "CON", getCon(feature));

  var fire_district = getFireDistrict(feature);
  //renderModalProperty(info_box, "Fire District", fire_district);

  // Calculate distance from user lat lon to center
  var geom = feature.getGeometry();
  var poly = new google.maps.Polygon({
    paths: geom.getAt(0).getArray(),
  });
  var feature_lat_lon = getPolygonCenter(poly);
  if (user_lat_lon != null)
    renderModalProperty(
      info_box,
      "Distance",
      getMiles(
        google.maps.geometry.spherical.computeDistanceBetween(
          feature_lat_lon,
          user_lat_lon
        )
      )
    );

  // Edit History
  {
    $.getJSON(api_host + "/sheriff/edit-history/" + parcel, function (data) {
      renderModalProperty(info_box, "Owner", data.owner);
      renderModalProperty(info_box, "Situs", data.situs);
      var houseNumber = data.situs;
      if (houseNumber.indexOf(" ") >= 0)
        houseNumber = houseNumber.split(" ")[0];

      selectFeature(feature, houseNumber, doCenter);
    });
  }

  document.getElementById("button-link-fire-truck-dispatch").onclick = () => {
    showFireTruckDispatchModal(parcel, fire_district);
  };

  if (!hideModal) $("#parcelModal").modal("show");
}

/**
 * Overridden from map.js - Change fill color for readability in satellite view
 *
 * Change the style of the feature that is selected, and pan to it
 * @param {*} selected_road
 */
function selectRoad(selected_road, label_text) {
  // Style and color the selected feature
  map.data.overrideStyle(selected_road, {
    strokeWeight: 8,
    fillColor: "white",
    strokeColor: "green",
  });

  // if (label) labelFeature(label, selected_road, true);
  // else labelFeature(parcelNum, selected_road);

  var geom = selected_road.getGeometry();
  var poly = new google.maps.Polygon({
    paths: geom.getArray(),
  });
  var center = getPolygonCenter(poly);
  map.panTo(center);

  var bounds = new google.maps.LatLngBounds();
  poly.getPaths().forEach(function (path, index) {
    var points = path.getArray();
    for (var p in points) bounds.extend(points[p]);
  });
  map.fitBounds(bounds);

  // Add a label at the center
  var marker = new google.maps.Marker({
    position: center,
    map: map,
    label: {
      text: label_text,
      color: "black",
      fontSize: "20px",
      fontWeight: "bold",
    },
    icon: "blank.png",
  });
  marker.setMap(map);

  selected_road.setProperty("selected", true);
}

/**
 * Overridden from map.js - Change fill color for readability in satellite view
 *
 * Change the style of the feature that is selected, and pan to it
 * @param {*} selected_feature
 */
function selectFeature(selected_feature, label, doCenter) {
  if (doCenter == null) doCenter = true;

  // Style and color the selected feature
  map.data.overrideStyle(selected_feature, {
    strokeWeight: 8,
    fillColor: "white",
    strokeColor: "green",
    fillOpacity: 0.3,
  });

  var parcelNum = selected_feature.getProperty("PARCEL_NUM");

  if (label) labelFeature(label, selected_feature, true);
  else labelFeature(parcelNum, selected_feature);

  if (doCenter === true) {
    var geom = selected_feature.getGeometry();
    var poly = new google.maps.Polygon({
      paths: geom.getAt(0).getArray(),
    });
    var center = getPolygonCenter(poly);
    map.panTo(center);
  }

  // Show the road label at the origin point for the marker for this parcel
  if (parcelNum) showMarkerOriginLabel(parcelNum);

  selected_feature.setProperty("selected", true);
}

/**
 * Show the road label at the origin point for the marker for this parcel by combing through marker_markers_origin
 * and checking for parcel numbers (defined in continueLoadingMarkers)
 * @param {*} parcelNum
 */
function showMarkerOriginLabel(parcelNum) {
  // Grab the origin markers for the parcel we care about
  for (var i = 0; i < markers.length; i++) {
    if (
      markers[i]
        .getProperty("NUMBER")
        .toUpperCase()
        .indexOf(parcelNum.toUpperCase()) >= 0
    ) {
      var marker = new google.maps.Marker({
        position: markers[i].getGeometry().getAt(0), // Origin point
        label: {
          text: markers[i].getProperty("NUMBER0"),
          color: "black",
          fontSize: "20px",
          fontWeight: "bold",
        },
        title: markers[i].getProperty("NUMBER"), // Store parcel number in marker for easier lookup
        map: null,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 0,
        },
      });
      marker_markers_origin.push(marker);
      break;
    }
  }
  for (var i = 0; i < marker_markers_origin.length; i++) {
    if (
      marker_markers_origin[i]
        .getTitle()
        .toUpperCase()
        .indexOf(parcelNum.toUpperCase()) >= 0
    ) {
      marker_markers_origin[i].setMap(map);
    }
  }
}

/**
 * Overridden from map.js - Change label size for readability in satellite view
 *
 * Draw a label on the map. The contents of the label are the feature's PARCEL_NUM property
 * @param {*} feature
 */
function labelFeature(
  label_text,
  feature,
  ignore_zoom_restriction,
  manual_lat_lon
) {
  if (
    (ignore_zoom_restriction != true &&
      map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD) ||
    label_text == null
  )
    return; // Don't show labels when zoomed out so much
  // Place a marker on there
  var geom = feature.getGeometry();
  var poly = new google.maps.Polygon({
    paths: geom.getAt(0).getArray(),
  });

  var lat_lon = manual_lat_lon;
  if (lat_lon == null) lat_lon = getPolygonCenter(poly); // Deault to center of Polygon

  // Set all other polygon labels to black, so only the recently searched one will show
  for (k in parcel_num_markers) {
    if (parcel_num_markers.hasOwnProperty(k)) {
      label = parcel_num_markers[k].getLabel();
      label.color = "black";
      parcel_num_markers[k].setLabel(label);
    }
  }

  var marker = new google.maps.Marker({
    position: lat_lon,
    map: map,
    label: {
      text: label_text,
      color: "green",
      fontSize: "20px",
      fontWeight: "bold",
    },
    icon: "blank.png",
  });

  parcel_num_markers.push(marker);

  return marker;
}

function getMiles(i) {
  return Math.round(10 * i * 0.000621371192) / 10 + " Miles";
}

var edit_history_search_set = [];

/**
 * Set up the Rural Address Search Modal
 */
function initSearchModal(transportation_zone) {
  var uri = api_host + "/rural-addresses/edit-history/" + transportation_zone;

  // Initial handler
  $("#searchValue").on("input", () => {
    doSearch();
  });

  $("#searchBy").on("change", function () {
    // Reset the search value container
    $("#searchValueLabel").html("Search Contains");
    $("#searchValueContainer").html(
      '<input class="form-control" id="searchValue"/>'
    );

    $("#searchValue").on("input", () => {
      doSearch();
    });

    doSearch();
  });

  $.getJSON(uri, function (data) {
    if (data.error_message) {
      console.log(data.error_message);
      $("#select-mode-inner").show();
      return;
    }

    edit_history_search_set = data;

    // Populate initial
    doSearch($("#searchBy").val(), $(".searchBy option:selected").val());
  });
}

// Rebind the submit form so pressing enter doesn't refresh the page
$("#searchModalForm").submit(function (e) {
  e.preventDefault();
  doSearch();
});

function doSearch() {
  var value = document.getElementById("searchValue").value.toUpperCase();
  var type = $("#searchBy option:selected").val();

  var results = [];

  if (type === "situs") {
    results = edit_history_search_set.filter((parcel) => {
      return parcel.situs.toUpperCase().indexOf(value) >= 0;
    });
  } else if (type === "road") {
    results = edit_history_search_set.filter((parcel) => {
      return parcel.road.toUpperCase().indexOf(value) >= 0;
    });
  } else if (type === "road_name") {
    // Get a list of all road numbers that match this road name
    var roads = transportations.filter((road) => {
      var name = road.getProperty("ROAD_NAME");
      return name != null && name.toUpperCase().indexOf(value) >= 0;
    });

    roads = roads.map((road) => {
      var roadNum = road.getProperty("NUMBER");
      if (roadNum) roadNum = roadNum.toUpperCase();
      return roadNum;
    });

    results = edit_history_search_set.filter((parcel) => {
      var parcelRoadUpper = parcel.road;
      if (parcelRoadUpper) parcelRoadUpper = parcelRoadUpper.toUpperCase();
      return roads.indexOf(parcelRoadUpper) >= 0;
    });
  } else if (type === "owner") {
    results = edit_history_search_set.filter((parcel) => {
      return parcel.owner.toUpperCase().indexOf(value) >= 0;
    });
  } else {
    // Default to Situs
    results = edit_history_search_set.filter((parcel) => {
      return parcel.situs.indexOf(value) >= 0;
    });
  }

  renderSearchResults(results);
}

function renderSearchResults(results) {
  $("#results_total").html(results.length);

  search_result_sets = []; // Split the results up into an array of arrays
  var arraySize = 20;
  var i, j;
  for (i = 0, j = results.length; i < j; i += arraySize) {
    var subset = results.splice(0, arraySize);
    if (subset.length <= 0) break;

    search_result_sets.push(subset);
  }

  if (search_result_sets.length <= 0) {
    var value = document.getElementById("searchValue").value.toUpperCase();
    var type = $("#searchBy option:selected").val();

    var zero_set = [];

    // If we search for a road number with no parcels on it (8290), add a dummy result
    // so the user can still click to go to the road
    if (type === "road") {
      var foundRoad = transportations.find((road) => {
        var name = road.getProperty("NUMBER");
        return name != null && name.toUpperCase().indexOf(value) >= 0;
      });
      if (foundRoad) {
        var dummy = {
          owner: "",
          situs: "",
          road: foundRoad.getProperty("NUMBER"),
          isRoad: true,
        };

        zero_set.push(dummy);
      }
    }

    search_result_sets.push(zero_set);
  }

  current_search_pagination = 0;
  renderTwentyResults(search_result_sets[current_search_pagination]); // Show the first subset by default

  if (search_result_sets.length >= 1) {
    renderSearchPagination();
  }

  function renderTwentyResults(resultssubset) {
    var body = document.getElementById("resultsTableBody");
    body.innerHTML = "";

    for (var i = 0; i < resultssubset.length; i++) {
      var parcel = resultssubset[i];
      var row = document.createElement("tr");
      row.className = "pointer";

      // Go to Parcel
      var cell = document.createElement("td");
      var link_to_parcel = document.createElement("a");

      row.setAttribute("data-dismiss", "modal");

      if (!parcel.isRoad) {
        link_to_parcel.innerHTML = "Go to Parcel";
        link_to_parcel.setAttribute("href", "#");
        link_to_parcel.setAttribute("data-toggle", "collapse");
        link_to_parcel.setAttribute("data-target", "#navbarSupportedContent");
        cell.onclick = getParcelFromMapClosure(parcel.apn);

        $(cell).append(link_to_parcel);
      }
      $(row).append(cell);

      $(row).append("<td>" + parcel.situs + "</td>");
      $(row).append("<td>" + parcel.owner + "</td>");

      var roadName = getRoadNameFromNumber(parcel.road);
      var link_to_road = document.createElement("a");
      link_to_road.innerHTML = parcel.road;
      link_to_road.setAttribute("href", "#");
      link_to_road.setAttribute("data-toggle", "collapse");
      link_to_road.setAttribute("data-target", "#navbarSupportedContent");
      var cell2 = document.createElement("td");
      $(cell2).append(link_to_road);
      cell2.onclick = getRoadFromMapClosure(parcel.road);
      $(row).append(cell2);
      $(row).append("<td>" + (roadName ? roadName : "") + "</td>");

      $(body).append(row);
    }

    function getParcelFromMapClosure(apn) {
      return function () {
        getParcelFromMap(apn, false, 15);
      };
    }

    function getRoadFromMapClosure(roadNumber) {
      return function () {
        getRoadFromMap(roadNumber);
      };
    }
  }

  function getRoadFromMap(roadNumber) {
    var roadNumberUpper = roadNumber.toUpperCase();
    roadNumberUpper = roadNumberUpper.replace("CR", "").trim();
    console.log(roadNumberUpper);
    var road = transportations.find((road) => {
      var loopRoad = road.getProperty("NUMBER");
      if (loopRoad) loopRoad = loopRoad.toUpperCase();
      return roadNumberUpper == loopRoad;
    });

    selectRoad(road, roadNumber);
  }

  function renderSearchPagination() {
    $("#search_previous").off();
    $("#search_next").off();

    if (current_search_pagination == 0) {
      $("#search_previous").html("");
    } else {
      $("#search_previous").html("Previous 20");

      $("#search_previous").on("click", function () {
        current_search_pagination--;
        renderTwentyResults(search_result_sets[current_search_pagination]);
        renderSearchPagination();
      });
    }

    if (current_search_pagination == search_result_sets.length - 1) {
      $("#search_next").html("");
    } else {
      $("#search_next").html("Next 20");
      $("#search_next").on("click", function () {
        current_search_pagination++;
        renderTwentyResults(search_result_sets[current_search_pagination]);
        renderSearchPagination();
      });
    }
  }
}

/**
 * Update last modified date in footer from data API
 */
function initLastModified() {
  var uri = api_host + "/rural-addresses/edit-history/";

  $.getJSON(uri, function (data) {
    var text = document.getElementById("editHistoryLastUpdated");

    var zone = data.zones.find((zone) => zone.name == transportation_zone);

    if (zone) {
      var date = new Date(zone.lastModified);
      text.innerHTML =
        "Last Modified: " +
        (date.getMonth() + 1) +
        "/" +
        date.getDate() +
        "/" +
        date.getFullYear();
    }
  });
}

function getRoadNameFromNumber(roadNumber) {
  var roadNumberUpper = roadNumber.toUpperCase();
  var road = transportations.find((road) => {
    var loopRoad = road.getProperty("NUMBER");
    if (loopRoad) loopRoad = loopRoad.toUpperCase();
    return roadNumberUpper == loopRoad;
  });

  return road ? road.getProperty("ROAD_NAME") : null;
}

/**
 * Initialize the GeoLocation so the user can see where they are on the map.
 * Then, given a parcel, zoom out to show both
 */
function initFireTruckGeoCode(feature) {
  bounds = new google.maps.LatLngBounds();

  // GeoMarker stuff
  navigator.geolocation.getCurrentPosition((position) => {
    geoInit(position);
    goToUserLatLon();
    initParcelParam();
  });

  function geoInit(position) {
    user_lat_lon = new google.maps.LatLng(
      position.coords.latitude,
      position.coords.longitude
    );

    user_marker = new google.maps.Marker({
      position: user_lat_lon,
      map: map,
      icon: "/geolocation-icon.png",
    });

    setInterval(function () {
      navigator.geolocation.getCurrentPosition((position) => {
        user_lat_lon = new google.maps.LatLng(
          position.coords.latitude,
          position.coords.longitude
        );
        user_marker.setPosition(user_lat_lon);
      });
    }, 1000);

    // // Extend view to fit user
    // bounds.extend(user_marker.getPosition());
    // map.fitBounds(bounds);
    // map.setCenter(bounds.getCenter());
  }
}

function showFireTruckDispatchModal(apn, fire_district) {
  $("#fireTruckDispatchModal").modal("show");

  // Remove other handlers from previous modal opens
  $("#fire-truck-dispatch-button").off();

  $(".fire-truck-dispatch-choices").prop("checked", false); // Uncheck all boxes

  // Find a default box to check
  if (fire_district === "Alpine") {
    $("#fire-truck-dispatch-choices-alpine").prop("checked", true);
  } else if (fire_district === "Eagar") {
    $("#fire-truck-dispatch-choices-eagar").prop("checked", true);
  } else if (fire_district === "Vernon") {
    $("#fire-truck-dispatch-choices-vernon").prop("checked", true);
  } else if (fire_district === "Greer") {
    $("#fire-truck-dispatch-choices-greer").prop("checked", true);
  }

  $("#fire-truck-dispatch-button").click((e) => {
    e.preventDefault();
    // Combine parcel JSON with form data and post as request body (AJAX)
    var body = {};
    body.recipients = [];
    body.apn = apn;
    body.zone = transportation_zone;

    $("input:checkbox[name=fire-truck-dispatch-choices]:checked").each(
      function () {
        body.recipients.push($(this).val());
      }
    );
    console.log(body.recipients);

    if (body.recipients.length <= 0) return;

    body.subject = $("#fire-truck-dispatch-subject").val();

    $.post("/rural-address/fire-truck-dispatch", body, function () {
      $("#fireTruckDispatchModal").modal("hide");
    });
  });
}
