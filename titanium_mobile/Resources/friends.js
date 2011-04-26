var PersonRow = function(person) {
};
exports.PersonRow = PersonRow;

PersonRow.prototype.follow = function(event) {
    var self = this;
    var alert = Ti.UI.createAlertDialog({
	    message: String.format(L("follow_username", "Follow %@"), this.person.name),
	    buttonNames: [L("cancel", "Cancel"), L("follow", "Follow")],
	    cancel: 0
    });
    alert.addEventListener("click", function(event) {
	    if(!event.cancel && event.index == 1) {
	        self.follow_me_now.follow(self.person.account)
		        .success(function() {
		            self.checked.visible = true;
		        })
		        .failure(function(message) {
			    var alert_params = {
			            title: L("failed_following", "Failed following"),
			            message: message,
			            buttonNames: [L("ok", "OK")]
		            };
		            var alert = Ti.UI.createAlertDialog(alert_params);
		            alert.show();
		        });
	    }
    });
    alert.show();
};
