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

	$('#searchBy').on('change', function() {
		switch($("#searchBy").val()) {
			case "date":
				$("#searchValueLabel").html("Edit Date Range");
				$("#searchValueContainer").html("<input class=\"form-control\" id=\"searchValue\"/>");
	
				// Instantiate the date range picker
				var start = moment().subtract(2, 'months');
				var end = moment();
	
				function cb(start, end) {
					// Search parcels by edit date
					doSearchByDate(start, end);
				}
				
				$("#searchValue").daterangepicker({
					startDate: start,
					endDate: end,
					alwaysShowCalendars: true,
					autoApply: true,
					maxDate: end,
					ranges: {
					   'Last 7 Days': [moment().subtract(6, 'days'), moment()],
					   'Last 30 Days': [moment().subtract(29, 'days'), moment()],
					   'Last 3 Months': [moment().subtract(2, 'months'), moment()],
					   'Last 6 Months': [moment().subtract(5, 'months'), moment()],
					}
				}, cb);
				
				doSearchByDate(start, end);
				
				break;
			default: 
				// Reset the search value container
				$("#searchValueLabel").html("Search Contains");
				$("#searchValueContainer").html("<input class=\"form-control\" id=\"searchValue\"/>");

				$("#searchValue").on("input", () => {
					doSearch();
				});

				doSearch();
		}
	  });

	$.getJSON(uri, function (data) 
	{
		if ( data.error_message )
		{
			console.log(data.error_message);
			$("#select-mode-inner").show();
			return;
		}

		edit_history_search_set = data;

		// Populate initial
		doSearch($("#searchBy").val(), $(".searchBy option:selected").val());
	});
}

function doSearchByDate(start, end) {
	var results = [];

	results = edit_history_search_set.filter(parcel => {
		return parcel.edits.findIndex(edit => {
			var searchByDate = moment(edit.date, "MM/DD/YYYY");
			return searchByDate.isBetween(start, end, 'days', '[]');
		}) >= 0;
	});

	renderSearchResults(results);
}

function doSearch() {

	var value = document.getElementById("searchValue").value;
	var type = $("#searchBy option:selected").val();

	var results = [];
	
	if (type === "situs") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.situs.indexOf(value) >= 0;
		});
	} else if ( type === "road") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.road.indexOf(value) >= 0;
		});
	} else if ( type === "road_name") {
		// Get a list of all road numbers that match this road name
		var roads = transportations.filter(road => {
			var name = road.getProperty('ROAD_NAME');
			return name != null && name.indexOf(value) >= 0;
		});

		roads = roads.map(road => {
			var roadNum = road.getProperty("NUMBER");
			if (roadNum) roadNum = roadNum.toUpperCase();
			return roadNum;
		});

		results = edit_history_search_set.filter(parcel => {
			var parcelRoadUpper = parcel.road;
			if (parcelRoadUpper) parcelRoadUpper = parcelRoadUpper.toUpperCase();
			return roads.indexOf(parcelRoadUpper) >= 0;
		});
	} else if ( type === "owner") {
		results = edit_history_search_set.filter(parcel => {
			return parcel.owner.toLowerCase().indexOf(value.toLowerCase()) >= 0;
		});
	} 
	else {
		results = edit_history_search_set.filter(parcel => {
			return parcel.apn.indexOf(value) >= 0;
		});
	}

	renderSearchResults(results);
}

function renderSearchResults(results) {

	$("#results_total").html(results.length);

	search_result_sets = []; // Split the results up into an array of arrays
	var arraySize = 20;
	var i, j;
	for (i = 0, j = results.length; i < j; i+= arraySize) {
		var subset = results.splice(i, arraySize);
		if (subset.length <= 0) break;
		
		search_result_sets.push(subset);
	}

	if (search_result_sets.length <= 0) search_result_sets.push([]);

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
			$(row).append("<td>" + parcel.apn + "</td><td>" + parcel.situs + "</td><td>" + parcel.road + "</td>");

			var roadName = getRoadNameFromNumber(parcel.road);
			$(row).append("<td>" + (roadName ? roadName : "") + "</td>");

			$(row).append("<td>" + parcel.owner + "</td>");

			var cell = document.createElement("td");
			var link_to_parcel = document.createElement("a");
			link_to_parcel.innerHTML = "Go to Parcel";
			link_to_parcel.setAttribute("href", "#");
			link_to_parcel.setAttribute("data-toggle", "collapse");
			link_to_parcel.setAttribute("data-target", "#navbarSupportedContent");

			row.setAttribute("data-dismiss", "modal");
			row.onclick = getParcelFromMapClosure(parcel.apn);

			$(cell).append(link_to_parcel);
			$(row).append(cell);
			$(body).append(row);
		};

		function getParcelFromMapClosure(apn) {
			return function() {
				getParcelFromMap(apn);
			}
		}
	}
	
	function renderSearchPagination() {
		$("#search_previous").off();
		$("#search_next").off();

		if (current_search_pagination == 0) {
			$("#search_previous").html("");
		} 
		else {
			$("#search_previous").html("Previous 20");
			
			$("#search_previous").on("click", function() {
				current_search_pagination--;
				renderTwentyResults(search_result_sets[current_search_pagination]);
				renderSearchPagination();
			});
		}

		if (current_search_pagination == search_result_sets.length - 1) {
			$("#search_next").html("");
		}
		else {
			$("#search_next").html("Next 20");
			$("#search_next").on("click", function() {
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

	$.getJSON(uri, function (data) 
	{
		var text = document.getElementById("editHistoryLastUpdated");

		var zone = data.zones.find(zone => zone.name == transportation_zone);

		if (zone) {
			var date = new Date(zone.lastModified);
			text.innerHTML = "Last Modified: " + (date.getMonth()+1) + "/" + date.getDate() + "/" + date.getFullYear();
		}
	});
}

function getRoadNameFromNumber(roadNumber) {
	var roadNumberUpper = roadNumber.toUpperCase();
	var road =  transportations.find(road => {
		var loopRoad = road.getProperty("NUMBER");
		if (loopRoad) loopRoad = loopRoad.toUpperCase();
		return roadNumberUpper == loopRoad;
	});

	return (road ? road.getProperty("ROAD_NAME") : null);
}