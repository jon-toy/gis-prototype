/**
 * Add this module to create a measureTool on the page.
 * 
 * Requirements
 * 1) Add this tag to HTML <script src="https://cdn.jsdelivr.net/npm/measuretool-googlemaps-v3/lib/MeasureTool.min.js"></script>
 * 2) The map variable must be defined in the main JS file
 * 3) Call initializeMeasureTool() after the map has been initialized.
 */

var measureTool;
var measure_mode = false;

function initializeMeasureTool() {
    measureTool = new MeasureTool(map, {
        unit: MeasureTool.UnitTypeId.IMPERIAL
    });
    
     // Create the DIV to hold the control and call the CenterControl()
    // constructor passing in this DIV.
    var centerControlDiv = document.createElement('div');
    var measureControl = new MeasureControl(centerControlDiv, map);
    
    centerControlDiv.index = 1;
    map.controls[google.maps.ControlPosition.LEFT_BOTTOM].push(centerControlDiv);
}

/**
 * The CenterControl adds a control to the map that recenters the map on
 * Chicago.
 * This constructor takes the control DIV as an argument.
 * @constructor
 */
function MeasureControl(controlDiv) {

	controlDiv.style.marginLeft = '10px';

	// Set CSS for the control border.
	var controlUI = document.createElement('div');
	controlUI.style.backgroundColor = '#fff';
	controlUI.style.border = '2px solid #fff';
	controlUI.style.borderRadius = '3px';
	controlUI.style.boxShadow = '0 2px 6px rgba(0,0,0,.3)';
	controlUI.style.cursor = 'pointer';
	controlUI.style.marginBottom = '22px';
	controlUI.style.textAlign = 'center';
	controlUI.title = (measure_mode == true ? 'Click to close measure controls' : 'Click to launch measure controls');
	controlDiv.appendChild(controlUI);

	// Set CSS for the control interior.
	var controlText = document.createElement('div');
	controlText.style.color = 'rgb(25,25,25)';
	controlText.style.fontFamily = 'Roboto,Arial,sans-serif';
	controlText.style.fontSize = '16px';
	controlText.style.lineHeight = '38px';
	controlText.style.paddingLeft = '5px';
	controlText.style.paddingRight = '5px';
	controlText.innerHTML = (measure_mode == true ? 'Cancel' : 'Measure Tool');
	controlUI.appendChild(controlText);

	// Setup the click event listeners: simply set the map to Chicago.
	controlUI.addEventListener('click', () => {
		if (measure_mode == false ) {
			measure_mode = true;
			controlText.innerHTML = 'Cancel';
			measureTool.start();

			map.data.setStyle(getFeatureStyle(false));
		}
		else {
			measure_mode = false;
			controlText.innerHTML = 'Measure Tool';
			measureTool.end();
			map.data.setStyle(getFeatureStyle(true));
		}
	});
}
