/**
 * This module contains the logic for caching feature data. Originally in RA viewer, broken out to use in FT Viewer
 * Load meta data for the zones. Compare with values in local storage to decide if we need to
 * re-get the parcel data. If not, load from local storage instead.
 */

var loadConfig = {
  disableParcels: false,
  disableMarkers: false,
  disableRoads: false,
  disableText: false,
};

var rotations = {};

/**
 * Initiate loading from cache. Can pass in a loadConfig that manually disables the loading of a specific
 * type of feature. Example: FT Viewer does not need to load parcels
 * @param {*} customConfig
 */
function initCacheLoad(customConfig) {
  if (customConfig != null) {
    loadConfig = customConfig;
  }
  initMetaData(loadConfig);
}

/**
 * Load meta data for the zones. Compare with values in local storage to decide if we need to
 * re-get the parcel data. If not, load from local storage instead.
 */
function initMetaData(loadConfig) {
  var uri = api_host + "/rural-addresses/meta-data";

  $.getJSON(uri, (data) => {
    // Get the meta data info from local storage to compare
    var localData = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_META_DATA);

    // Flag to show which zone is currently in local storage, if any
    var zoneFlag = localStorageGetItemAsString(LOCAL_STORAGE_KEY_ZONE_FLAG);

    // Check if local storage meta data is here, if zone data is here,
    // and if the zone in storage is the one we want to load. If not, load everything from scratch.
    if (localData == null || zoneFlag != transportation_zone) {
      load_from_local_storage.markers = false;
      load_from_local_storage.parcels = false;
      load_from_local_storage.roads = false;
      load_from_local_storage.text = false;

      // Save meta-data in local storage. Since we're starting fresh, wipe out the old stuff
      localStorage.clear();
      try {
        localStorageSetItem(LOCAL_STORAGE_KEY_META_DATA, JSON.stringify(data));
        localStorageSetItem(LOCAL_STORAGE_KEY_ZONE_FLAG, transportation_zone);
      } catch (e) {}

      initFeatures(null, null, loadConfig.preParcelCallback);

      return;
    }

    if (JSON.stringify(data) == JSON.stringify(localData)) {
      initFeatures(null, null, loadConfig.preParcelCallback);
      return; // Identical meta data for all zones, so load all components
      // from local storage
    }

    // Data is different, so something has changed. Check the current zone
    var zone = data.find((zone) => zone.name == transportation_zone);
    var localZone = localData.find((zone) => zone.name == transportation_zone);

    if (JSON.stringify(zone) == JSON.stringify(localZone)) {
      initFeatures(null, null, loadConfig.preParcelCallback);
      return; // Identical meta data for this zone, so load all components
      // from local storage
    }

    // This zone has changed, so see what's changed
    // Markers
    var markers = zone.files.find((file) => file.name == "markers.json");
    var localMarkers = localZone.files.find(
      (file) => file.name == "markers.json"
    );
    if (markers.lastModified != localMarkers.lastModified)
      load_from_local_storage.markers = false;

    // Parcels
    var parcels = zone.files.find((file) => file.name == "parcels.json");
    var localParcels = localZone.files.find(
      (file) => file.name == "parcels.json"
    );
    if (parcels.lastModified != localParcels.lastModified)
      load_from_local_storage.parcels = false;

    // Roads
    var roads = zone.files.find((file) => file.name == "roads.json");
    var localRoads = localZone.files.find((file) => file.name == "roads.json");
    if (roads.lastModified != localRoads.lastModified)
      load_from_local_storage.roads = false;

    // Text
    var text = zone.files.find((file) => file.name == "text.json");
    var localText = localZone.files.find((file) => file.name == "text.json");
    if (text.lastModified != localText.lastModified)
      load_from_local_storage.text = false;

    // Something changed, so update local storage
    localStorageSetItem(LOCAL_STORAGE_KEY_META_DATA, JSON.stringify(data));

    initFeatures(null, null, loadConfig.preParcelCallback);
  });
}

/**
 * Load a map displaying the parcels. Click on a parcel to display info. If a zone number is provided,
 * load only the parcels in that zone. If not, load ALL the parcels
 * @param {*} zone_num
 */
function initFeatures(zone_num, starting_lat_lon, preParcelCallback) {
  loadingFadeIn();

  // Create the Map object
  var starting_zoom = trans_zone_starting_point_zoom;

  if (starting_lat_lon == null)
    starting_lat_lon = new google.maps.LatLng(
      trans_zone_starting_point.lat,
      trans_zone_starting_point.lon
    ); // Starting position
  if (starting_zoom == null)
    starting_zoom = FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD;

  map = new google.maps.Map(document.getElementById("map"), {
    center: starting_lat_lon,
    zoom: starting_zoom,
    fullscreenControl: false,
    scaleControl: true,
    gestureHandling: "greedy",
  });

  // Load the measure tool from measure_tool.js
  initializeMeasureTool();

  // Highlight the parcels
  map.data.addListener("mouseover", function (event) {
    var color = "#28a745";
    map.data.overrideStyle(event.feature, {
      strokeWeight: 8,
      fillColor: color,
      strokeColor: color,
    });
    displayCoordinates(event.latLng);
    if (loadConfig.disableParcels != true) displayParcel(event.feature);

    current_parcel_marker = labelFeature(
      event.feature.getProperty("PARCEL_NUM"),
      event.feature,
      true
    );
  });

  map.data.addListener("mouseout", function (event) {
    map.data.revertStyle();

    if (current_parcel_marker != null) {
      current_parcel_marker.setMap(null);
    }
  });

  // Show modal on click
  map.data.addListener("click", function (event) {
    showFeature(event.feature);

    event.feature.setProperty("selected", true);
  });

  // Populate the Lat Lon. Separate from the mouseover so we keep track outside the parcels
  google.maps.event.addListener(map, "mousemove", function (event) {
    displayCoordinates(event.latLng);
  });

  // Wipe out the labels after we zoom out enough so it doesn't clutter the map
  map.addListener("zoom_changed", function () {
    if (
      map.getZoom() < FEATURE_LABEL_VISIBLE_ZOOM_THRESHOLD &&
      loadConfig.disableMarkers != true
    ) {
      // Wipe markers
      for (var i = 0; i < parcel_num_markers.length; i++) {
        parcel_num_markers[i].setMap(null);
      }

      parcel_num_markers = [];
    }
  });

  // Load sheriff specific GeoJSONs
  initFireCon(api_host);

  if (preParcelCallback) preParcelCallback();

  // Load Parcels
  if (loadConfig.disableParcels != true) {
    var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_PARCELS);
    if (load_from_local_storage.parcels == true && data != null) {
      // Local Storage
      console.log("Loaded from localStorage: Parcels");
      continueLoadingParcels(data);
    } else {
      // Get from API
      $.getJSON(
        api_host +
          "/transportation/zones/" +
          transportation_zone +
          "/parcels.json",
        function (data) {
          // Store in local storage
          localStorageSetItem(LOCAL_STORAGE_KEY_PARCELS, JSON.stringify(data));

          continueLoadingParcels(data);
        }
      );
    }
  }

  function continueLoadingParcels(data) {
    try {
      var features = map.data.addGeoJson(data);
      all_features = all_features.concat(features);
    } catch (err) {
      console.log(err);
    }

    loadingFadeOut();

    var parcel_num_param = getUrlParam("parcel");
    if (parcel_num_param != null) {
      getParcelFromMap(parcel_num_param);
    }
  }

  // Load Markers
  if (loadConfig.disableMarkers != true) {
    var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_MARKERS);
    if (load_from_local_storage.markers == true && data != null) {
      // Local Storage
      console.log("Loaded from localStorage: Markers");
      continueLoadingMarkers(data);
    } else {
      // Get from API
      $.getJSON(
        api_host +
          "/transportation/zones/" +
          transportation_zone +
          "/markers.json",
        function (data) {
          // Store in local storage
          localStorageSetItem(LOCAL_STORAGE_KEY_MARKERS, JSON.stringify(data));

          continueLoadingMarkers(data);
        }
      );
    }
  }

  function continueLoadingMarkers(data) {
    // Allow for custom override for populating the text markers
    if (loadConfig.continueLoadingMarkersCustom) {
      loadConfig.continueLoadingMarkersCustom(data);
      return;
    }

    markers = map.data.addGeoJson(data);
    for (var i = 0; i < markers.length; i++) {
      markers[i].setProperty("marker", true);
    }
  }

  // Load Text
  if (loadConfig.disableText != true) {
    var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_TEXT);

    // Get Rotation Values
    $.getJSON(
      api_host + "/rural-addresses/rotations/" + transportation_zone,
      function (data) {
        rotations = data;
      }
    );

    if (load_from_local_storage.text == true && data != null) {
      // Local Storage
      console.log("Loaded from localStorage: Text");
      continueLoadingText(data);
    } else {
      // Get from API
      $.getJSON(
        api_host +
          "/transportation/zones/" +
          transportation_zone +
          "/text.json",
        function (data) {
          // Store in local storage
          localStorageSetItem(LOCAL_STORAGE_KEY_TEXT, JSON.stringify(data));

          continueLoadingText(data);
        }
      );
    }
  }

  function continueLoadingText(data) {
    // Allow for custom override for populating the text markers
    if (loadConfig.continueLoadingTextCustom) {
      loadConfig.continueLoadingTextCustom(data);
      return;
    }

    var buffer = new google.maps.Data();
    text = buffer.addGeoJson(data);

    class RotatedLabel extends google.maps.OverlayView {
      constructor(position, text, rotation, map, customStyles = {}) {
        super();

        // Initialize all properties.
        this.position_ = position;
        this.text_ = text;
        if (rotation > 90 && rotation < 270) {
          rotation += 180;
        }
        this.rotation_ = rotation;
        this.customStyles_ = customStyles;

        // Define a property to hold the image's div. We'll
        // actually create this div upon receipt of the onAdd()
        // method so we'll leave it null for now.
        this.div_ = null;

        // Explicitly call setMap on this overlay.
        this.setMap(map);
      }

      /**
       * onAdd is called when the map's panes are ready and the overlay has been
       * added to the map.
       */
      onAdd() {
        const div = document.createElement("div");
        div.style.borderStyle = "none";
        div.style.borderWidth = "0px";
        div.style.position = "absolute";

        // Create the img element and attach it to the div.
        const textElement = document.createElement("div");
        textElement.textContent = this.text_;
        textElement.style.transform = `rotate(${this.rotation_}deg)`;
        textElement.style.transformOrigin = "50% 50%";
        textElement.style.position = "absolute";
        textElement.style.whiteSpace = "nowrap";
        for (let [key, value] of Object.entries(this.customStyles_)) {
          textElement.style[key] = value;
        }
        this.textElement = textElement;
        div.appendChild(textElement);
        this.div_ = div;

        // Add the element to the "overlayLayer" pane.
        const panes = this.getPanes();
        panes.overlayLayer.appendChild(div);
      }

      draw() {
        // We use the south-west and north-east
        // coordinates of the overlay to peg it to the correct position.
        // To do this, we need to retrieve the projection from the overlay.
        this.overlayProjection = this.getProjection();
        this.moveOverlayDiv();
      }

      moveOverlayDiv() {
        // Retrieve position coordinates of this overlay
        // in LatLngs and convert them to pixel coordinates.
        // We'll use these coordinates to resize the div.
        const divPixel = this.overlayProjection.fromLatLngToDivPixel(
          this.position_
        );

        const div = this.div_;
        div.style.left = divPixel.x + "px";
        div.style.top = divPixel.y + "px";
      }

      // The onRemove() method will be called automatically from the API if
      // we ever set the overlay's map property to 'null'.
      onRemove() {
        if (!this.div_) {
          return;
        }

        this.div_.parentNode.removeChild(this.div_);
        this.div_ = null;
      }

      getPosition() {
        return this.position_;
      }

      setPosition(position) {
        this.position_ = position;

        if (!this.overlayProjection) return;

        this.moveOverlayDiv();
      }

      getText() {
        return this.text_;
      }

      setText(text) {
        this.text_ = text;
        this.textElement.textContent = this.text_;
      }

      getRotation() {
        return this.rotation_;
      }

      setRotation(rotation) {
        this.rotation_ = rotation;
        this.textElement.style.transform = `rotate(${this.rotation_}deg)`;
      }

      getCustomStyles() {
        return this.customStyles_;
      }

      setCustomStyles(customStyles) {
        this.customStyles_ = customStyles;
        for (let [key, value] of Object.entries(this.customStyles_)) {
          this.textElement.style[key] = value;
        }
      }
    }

    for (var i = 0; i < text.length; i++) {
      var textString = text[i].getProperty("TEXTSTRING");
      // Create a label
      var marker = new RotatedLabel(
        text[i].getGeometry().get(),
        textString,
        getTextStringRotation(textString),
        null,
        {
          color: "red",
        }
      );

      // var marker = new google.maps.Marker({
      // 	position: text[i].getGeometry().get(),
      // 	label: text[i].getProperty("TEXTSTRING"),
      // 	map: null,
      // 	icon: {
      // 		path: google.maps.SymbolPath.CIRCLE,
      // 		scale: 0
      // 	}
      // });

      marker_markers.push(marker);
    }

    function getTextStringRotation(textString) {
      for (var i = 0; i < rotations.length; i++) {
        if (rotations[i].marker === textString)
          return rotations[i].radians * (180 / Math.PI);
      }
    }
  }

  // Load Roads
  if (loadConfig.disableRoads != true) {
    var data = localStorageGetItemAsObject(LOCAL_STORAGE_KEY_ROADS);
    if (load_from_local_storage.roads == true && data != null) {
      // Local Storage
      console.log("Loaded from localStorage: Roads");
      continueLoadingRoads(data);
    } else {
      // Get from API
      $.getJSON(
        api_host +
          "/transportation/zones/" +
          transportation_zone +
          "/roads.json",
        function (data) {
          // Store in local storage
          localStorageSetItem(LOCAL_STORAGE_KEY_ROADS, JSON.stringify(data));

          continueLoadingRoads(data);
        }
      );
    }

    function continueLoadingRoads(data) {
      transportations = map.data.addGeoJson(data);
      loadingFadeOut();

      // Set colors
      map.data.setStyle(function (feature) {
        // Transporation
        if (transportations.indexOf(feature) >= 0) {
          if (feature.getProperty("selected")) {
            return {
              strokeColor: "'#20c997'",
              strokeOpacity: 0.8,
              strokeWeight: 3,
              zIndex: 5,
            };
          }

          return {
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 3,
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
          fillColor: color,
          fillOpacity: 0.2,
          strokeColor: color,
          strokeWeight: 1,
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
          showSitusMarkers(event.feature.getProperty("NUMBER"));
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
        } else {
          displayParcel(event.feature);
        }

        current_parcel_marker = labelFeature(
          event.feature.getProperty("PARCEL_NUM"),
          event.feature,
          true
        );
      });
    }
  }

  initSpecific(api_host);

  mapsScaleMilesHack();
}
