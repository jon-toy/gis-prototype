//const api_host = "http://localhost:3001";
const api_host = "https://apachecounty.org";
var transportations = [];
var markers = [];
var marker_markers = [];
var text = [];
var meta_data = []; // Meta data for all zones. Allows us to see last modified date to know if we should pull from
// localStorage or not

// Search
var current_search_pagination = 0;
var search_result_sets = [];

var transportation_zone = getUrlParam("zone");
var valid_transportation_zones = [
  "south",
  "vernon",
  "north",
  "east",
  "concho",
  "springervilleeagar",
];
var transportation_zone_zooms = [14, 12, 12, 12, 12];
var transportation_zones_starting_points = [
  { lat: 33.9513, lon: -109.2292 },
  { lat: 34.3293, lon: -109.7816 },
  { lat: 35.1159, lon: -109.5619 },
  { lat: 34.6607, lon: -109.192 },
  { lat: 34.5180075, lon: -109.69512700000001 },
  { lat: 34.1096, lon: -109.2906 },
];

// Only show valid zones
var trans_zone_index = valid_transportation_zones.indexOf(transportation_zone);
if (trans_zone_index < 0) {
  transportation_zone = valid_transportation_zones[0];
  trans_zone_index = 0;
}

var trans_zone_starting_point =
  transportation_zones_starting_points[trans_zone_index];
var trans_zone_starting_point_zoom =
  transportation_zone_zooms[trans_zone_index];

$(document).ready(function () {
  initFeedback();
  initParcelParam();
  initSearchModal(transportation_zone);

  mapsScaleMilesHack();

  initLastModified();
});

function mapCallback() {
  var loadConfig = {
    disableParcels: false,
    disableMarkers: false,
    disableRoads: false,
    disableText: false,
  };
  initCacheLoad(loadConfig);
}

function initParcelParam() {
  // Get the parcel
  var parcel_num_param = getUrlParam("parcel");
  if (parcel_num_param == null) return;

  $("#select-mode-inner").hide();
}

/**
 * Get the feature/parcel from the map, given a parcel number
 * @param {} parcel_num
 */
function getParcelFromMap(parcel_num) {
  if (parcel_num == null)
    parcel_num = document.getElementById("search-by-parcel-number").value;
  if (parcel_num == null || parcel_num.length <= 0) return;

  // Sanitize the input value
  var sanitized_input = parcel_num.replace("-", "");
  while (sanitized_input.indexOf("-") >= 0) {
    sanitized_input = sanitized_input.replace("-", ""); // Search ignores hyphens
  }
  sanitized_input = sanitized_input.toUpperCase(); // Search ignores case

  for (var i = 0; i < all_features.length; i++) {
    var feature = all_features[i];

    // Sanitize the current parcel's parcel number
    var sanitized_feature_parcel_num = feature.getProperty("PARCEL_NUM");
    sanitized_feature_parcel_num = sanitized_feature_parcel_num.replace(
      "-",
      ""
    );
    while (sanitized_feature_parcel_num.indexOf("-") >= 0) {
      sanitized_feature_parcel_num = sanitized_feature_parcel_num.replace(
        "-",
        ""
      ); // Search ignores hyphens
    }
    sanitized_feature_parcel_num = sanitized_feature_parcel_num.toUpperCase(); // Search ignores case

    // Compare
    if (sanitized_input == sanitized_feature_parcel_num) {
      $("#select-mode-inner").hide();

      showFeature(feature);
      selectFeature(feature);

      // Zoom in
      map.setZoom(15);
      return;
    }
  }
}

/**
 * Parse out properties from the feature, place those properties into the Parcel Modal,
 * and show it.
 * @param {*} feature
 */
function showFeature(feature) {
  map.data.revertStyle();
  map.data.overrideStyle(feature, {
    strokeWeight: 8,
    fillColor: "blue",
    strokeColor: "blue",
  });

  // Feature properties that we need to get in advance
  var parcel = feature.getProperty("PARCEL_NUM");
  var account_number = feature.getProperty("NUMBER");
  var owner = feature.getProperty("OWNER");
  var size = feature.getProperty("SIZE");
  if (size) size += " Ac.";

  var show_mid_bar = account_number && owner && size;

  var info_box = document.getElementById("parcel_content");
  info_box.innerHTML = "";

  document.getElementById("parcelModalLabel").innerHTML = "Parcel " + parcel;

  renderModalProperty(info_box, "Situs", feature.getProperty("SITUS"));
  renderModalProperty(info_box, "CON", getCon(feature));

  var fire_district = getFireDistrict(feature);
  //renderModalProperty(info_box, "Fire District", fire_district);

  if (show_mid_bar == true)
    renderModalProperty(info_box, "", "", "border-top my-3");
  renderModalProperty(info_box, "Owner", owner);
  renderModalProperty(info_box, "Account Information", account_number);
  renderModalProperty(info_box, "Size", size);

  // Edit History
  {
    $.getJSON(api_host + "/sheriff/edit-history/" + parcel, function (data) {
      renderModalProperty(info_box, "Situs", data.situs);
      renderModalProperty(info_box, "Owner", data.owner);
      renderModalProperty(info_box, "Remarks", data.remarks);

      if (data.edits.length > 0) {
        var edit_history_html =
          '<table class="editHistory"><tr><th>Description</th><th>Date</th></tr>';
        for (var i = 0; i < data.edits.length; i++) {
          edit_history_html += "<tr>";
          edit_history_html += "<td>" + data.edits[i].text + "</td>";
          edit_history_html += "<td>" + data.edits[i].date + "</td>";
          edit_history_html += "</tr>";
        }
        edit_history_html += "</table>";
        renderModalProperty(info_box, "Edits", edit_history_html);
      }
    });
  }

  document.getElementById("button-link-parcel-feedback").onclick = () => {
    showParcelFeedbackModal(parcel);
  };

  // document.getElementById("button-link-fire-truck-dispatch").onclick = () => {
  //   showFireTruckDispatchModal(parcel, fire_district);
  // };

  $("#parcelModal").modal("show");

  selectFeature(feature);
}

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host
 */
function initSpecific(api_host) {}

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

  $("#transportationModal").modal("show");

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
  for (var i = 0; i < marker_markers.length; i++) {
    if (
      marker_markers[i].getText().toUpperCase().indexOf(number.toUpperCase()) >=
      0
    )
      marker_markers[i].setMap(map);
    else marker_markers[i].setMap(null);
  }
}

function showParcelFeedbackModal(apn) {
  var parcel = edit_history_search_set.find((parcel) => {
    return parcel.apn == apn;
  });

  if (parcel == null) return;

  var container = document.getElementById("feedback-parcel-info");
  container.innerHTML = "";

  var apn = document.createElement("span");
  apn.innerHTML = "<b>APN</b>: " + parcel.apn;
  container.appendChild(apn);

  if (parcel.owner) {
    container.appendChild(document.createElement("br"));

    var owner = document.createElement("span");
    owner.innerHTML = "<b>Owner</b>: " + parcel.owner;
    container.appendChild(owner);
  }

  if (parcel.road) {
    container.appendChild(document.createElement("br"));

    var road = document.createElement("span");
    road.innerHTML = "<b>Road</b>: " + parcel.road;
    container.appendChild(road);
  }

  $("#parcelFeedbackModalLabelTitle").html(parcel.apn);

  $("#parcelFeedbackModal").modal("show");

  // Remove other handlers from previous modal opens
  $("#submit-parcel-feedback-button").off();

  $("#submit-parcel-feedback-button").click((e) => {
    e.preventDefault();
    // Combine parcel JSON with form data and post as request body (AJAX)
    var body = {};
    body.parcel = parcel;
    body.name = document.getElementById("parcel-feedback-name").value;
    body.email = document.getElementById("parcel-feedback-email").value;
    body.feedback = document.getElementById("parcel-feedback-feedback").value;

    if (
      body.email.length <= 0 ||
      body.name.length <= 0 ||
      body.feedback.length <= 0
    )
      return;

    $.post("/rural-address/send-feedback", body, function (data) {
      $("#parcelFeedbackModal").modal("hide");
    });
  });
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
