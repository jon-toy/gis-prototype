var transportations = [];

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host 
 */
function initSpecific(api_host)
{
    loadingFadeIn();

    $.getJSON(api_host + "/transportation/transportation.json", function (data) 
    {
        var starting_lat_lon = new google.maps.LatLng(34.1259, -109.2801); 

        transportations = map.data.addGeoJson(data);
        console.log("Added transportation data");
        console.log(transportations);

        loadingFadeOut();

        // Set colors
		map.data.setStyle(function(feature) {
            // Transporation
            if ( transportations.indexOf(feature) >= 0 )
            {
				if (feature.getProperty('selected')) 
				{
					return ({
						strokeColor: "'#20c997'",
						strokeOpacity: 0.8,
						strokeWeight: 7,
						zIndex: 5
					});
				}
				
                return ({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
					strokeWeight: 7,
					zIndex: 5
                });
			}
		
            // Parcels
			var color = '#007bff';

			// Change the color of the feature permanently
			if (feature.getProperty('selected')) 
			{
				color = '#20c997';
			}

			return /** @type {google.maps.Data.StyleOptions} */({
			fillColor: color,
			fillOpacity: 0.1,
			strokeColor: color,
			strokeWeight: 1
			});
        });

        // Remove all listeners
        google.maps.event.clearListeners(map.data, 'click');
        google.maps.event.clearListeners(map.data, 'mouseover');
        
        // Show modal on click
		map.data.addListener('click', function(event) 
		{	
			for ( var i = 0; i < transportations.length; i++ )
				transportations[i].setProperty('selected', false);

            event.feature.setProperty('selected', true);

            // Transporation
            if ( transportations.indexOf(event.feature) >= 0 )
            {
				showSitusMarkers(event.feature.getProperty("NUMBER"));
                return showTransportation(event.feature)
            }

			showFeature(event.feature);
        });
        
        // Mouse over
        map.data.addListener('mouseover', function(event) {
			var color = '#28a745';
			map.data.overrideStyle(event.feature, {strokeWeight: 8, fillColor:color, strokeColor:color});
            displayCoordinates(event.latLng);
            
            if ( transportations.indexOf(event.feature) >= 0 )
            {
                displayTransportation(event.feature);
			}
			else if ( transportations.indexOf(event.feature) >= 0 )
            {
                displayMarker(event.feature);
			}
            else
            {
                displayParcel(event.feature);
            }

			current_parcel_marker = labelFeature(event.feature.getProperty('PARCEL_NUM'), event.feature, true);
        });
    });
}

/**
 * Display the Transportation on the bottom bar
 * @param {*} feature 
 */
function displayTransportation(feature) 
{
    document.getElementById("parcel-num-display").innerHTML = "Road: " + feature.getProperty('NUMBER');
}


/**
 * Parse out properties from the transportation feature, place those properties into the Transportation Modal,
 * and show it.
 * @param {*} feature 
 */
function showTransportation(feature)
{	  
	map.data.revertStyle();
    map.data.overrideStyle(feature, {strokeWeight: 8, fillColor:'blue', strokeColor:'blue'});
    
    console.log(feature);

    var info_box = document.getElementById('transportation_content');
	info_box.innerHTML = "";

	document.getElementById("transportationModalLabel").innerHTML = "Road " + feature.getProperty("NUMBER");

    renderModalProperty(info_box, "Number 0", feature.getProperty('NUMBER0'));
    renderModalProperty(info_box, "Road Name", feature.getProperty('ROAD_NAME'));
    renderModalProperty(info_box, "Number 1", feature.getProperty('NUMBER1'));
	
	// Feature properties that we need to get in advance
	/*var parcel = feature.getProperty('PARCEL_NUM');
	var account_number = feature.getProperty('NUMBER');
	var owner = feature.getProperty('OWNER');
	var size = feature.getProperty('SIZE');
	if ( size ) size += " Ac."

	var show_mid_bar = ( account_number && owner && size );

	var info_box = document.getElementById('transportation_content');
	info_box.innerHTML = "";

	document.getElementById("transportationModalLabel").innerHTML = "Parcel " + parcel;

	renderModalProperty(info_box, "Situs", feature.getProperty('SITUS'));
	renderModalProperty(info_box, "CON", getCon(feature));
	renderModalProperty(info_box, "Fire District", getFireDistrict(feature));
	if ( show_mid_bar == true ) renderModalProperty(info_box, "", "", "border-top my-3");
	renderModalProperty(info_box, "Owner", owner);
	renderModalProperty(info_box, "Account Information", account_number);
	renderModalProperty(info_box, "Size", size);

	if ( account_number )
	{
		$.getJSON("https://apachecounty.org/treasurer/account-balance/" + account_number, function (data)
		{
			var with_decimal = data.balance_due.substring(0, data.balance_due.length - 2) + '.' + data.balance_due.substring(data.balance_due.length - 2, data.balance_due.length);

			renderModalProperty(info_box, "Balance Due", "$" + with_decimal);
		});
	}

	document.getElementById("button-link-assessor").href = "http://www.co.apache.az.us/eagleassessor/?account=" + account_number;
	document.getElementById("button-link-treasurer").href = "http://www.co.apache.az.us/eagletreasurer/?account=" + account_number;
	*/
	$("#transportationModal").modal("show");

    selectFeature(feature);
    
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
}

function showSitusMarkers(number)
{
	for ( var i = 0; i < marker_markers.length; i++ )
	{
		if ( marker_markers[i].getLabel().indexOf(number.toUpperCase()) >= 0 )
			marker_markers[i].setMap(map);
		else
			marker_markers[i].setMap(null);
	}
}