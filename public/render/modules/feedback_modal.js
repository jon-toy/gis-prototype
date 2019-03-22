/**
 * This module contains the captcha and ajax for submitting general feedback (NOT parcel feedback)
 * 
 * Requirements
 * 1) Add initFeedback() in the document.ready() function of the page
 * 
 */

/**
 * Set up the reCaptcha listeners
 */
function initFeedback()
{
	window.verifyRecaptchaCallback = function (response) {
        $('input[data-recaptcha]').val(response).trigger('change')
    }

    window.expiredRecaptchaCallback = function () {
        $('input[data-recaptcha]').val("").trigger('change')
    }

	$('#submit-feedback-form').submit(function() {
	  $(this).ajaxSubmit({
		error: function(xhr) {
		  status('Error: ' + xhr.status);
		},
	   success: function(response) {
		if ( response.success == true )
		{
			alert("Thank you for submitting feedback, " + response.name + "!");
			$('#feedbackModal').modal('hide');
		}
		else
		{
			alert(response.message);
		}

		grecaptcha.reset();
	   }
	  });

	  //Very important line, it disable the page refresh.
	  return false;
	});
}  