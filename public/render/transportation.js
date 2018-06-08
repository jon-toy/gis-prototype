var transportations = [];

/**
 * Page-specific JS, called after parcel load. Load the transportation lines.
 * @param {*} api_host 
 */
function initSpecific(api_host)
{
    $.getJSON(api_host + "/transportation/transportation.json", function (data) 
    {
        var starting_lat_lon = new google.maps.LatLng(34.1259, -109.2801);

        transportations = map.data.addGeoJson(data);
        console.log("Added transportation data");
        console.log(transportations);

        // Set colors
		map.data.setStyle(function(feature) {
            // Transporation
            if ( transportations.indexOf(feature) >= 0 )
            {
                return ({
                    strokeColor: "#FF0000",
                    strokeOpacity: 0.8,
                    strokeWeight: 5,
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
			strokeColor: color,
			strokeWeight: 1
			});
        });
        
        // Show modal on click
		map.data.addListener('click', function(event) 
		{	
            // Transporation
            if ( transportations.indexOf(event.feature) >= 0 )
            {
                showTransporation()
            };

			showFeature(event.feature);
			
			event.feature.setProperty('selected', true);
		});
    });
}