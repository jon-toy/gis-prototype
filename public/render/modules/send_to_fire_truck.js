populateFireTruckOptions();

function populateFireTruckOptions() {
    var container = document.getElementById("fire-truck-dispatch-options");
    if (!container) return;

	$.getJSON("https://apachecountyfirecontact.firebaseio.com/fire/contacts.json", function (data) 
	{
        const options = data.sort((a, b) => {
            if (a.department == b.department) return 0;
            else if (a.department > b.department) return 1;
            
            return -1;
        })
        
        // Make an object with an attribute for each department
        var optionsByDepartment = {};

        for (var i = 0; i < options.length; i++) {
            var department = options[i].department;
            if (optionsByDepartment[department] == null) {
                optionsByDepartment[department] = []; // Make a new array
            }

            optionsByDepartment[department].push(options[i]);
        }

        for (var property in optionsByDepartment) {
            renderDepartment(property, optionsByDepartment[property]);
        }
	});
}

function renderDepartment(departmentName, department) {
    var container = document.getElementById("fire-truck-dispatch-options");
    var departmentClass = "fire-truck-dispatch-choices-" + departmentName.toLowerCase();

    var outerContainer = document.createElement('div');
    outerContainer.className = 'form-check';
    
        var input = document.createElement('input');
        input.className = 'form-check-input fire-truck-dispatch-choices ' + departmentClass + '-title';
        input.name = 'fire-truck-dispatch-choices';
        input.type = 'checkbox';
        input.value = '-1';
        input.id = 'fire-truck-dispatch-choices-' + departmentName.toLowerCase();
        input.onclick = function() {
            if (document.getElementById('fire-truck-dispatch-choices-' + departmentName.toLowerCase()).checked === true)
                $('.' + departmentClass).show();
            else {
                $('.' + departmentClass).hide();
                $('.' + departmentClass).prop('checked', false);
            }
        }
    
    outerContainer.appendChild(input);

        var label = document.createElement('label');
        label.className = 'form-check-label';
        label.setAttribute('for', input.id);
        label.innerHTML = departmentName;
    
    outerContainer.appendChild(label);

        var ul = document.createElement('ul');
        ul.className = departmentClass;

            var li = document.createElement('li');
            li.innerHTML = '<label><input type="checkbox" class="form-check-input fire-truck-dispatch-choices ' + departmentClass + 
                '" id="' + departmentClass + '-all">Select All</label>'
            li.onclick = function() {
                if (document.getElementById(departmentClass + '-all').checked === true) {
                    $('.' + departmentClass).prop('checked', true);
                }
                else {
                    $('.' + departmentClass).prop('checked', false);
                }
            }
            ul.appendChild(li);

            const departmentSorted = department.sort((a, b) => {
                if (a.name == b.name) return 0;
                else if (a.name > b.name) return 1;
                
                return -1;
            })
            for(var i = 0; i < departmentSorted.length; i++) {
                var li = document.createElement('li');
                li.className = departmentClass + '-li';
                li.innerHTML = '<label><input type="checkbox" class="form-check-input fire-truck-dispatch-choices ' + departmentClass + 
                    '" value="' + departmentSorted[i].id + '" name="fire-truck-dispatch-choices">' + departmentSorted[i].name + ' (' + departmentSorted[i].type + ')</label>'
                ul.appendChild(li);
            }

        outerContainer.appendChild(ul);

    container.appendChild(outerContainer);

    $('.' + departmentClass).hide();
}