var Friends = require("friends");
var PullToRefresh = require("pull_to_refresh");

var PersonRow = function(follow_me_now, person) {
    var self = this;
    this.follow_me_now = follow_me_now;
    this.person = person;
    
    this.row = Ti.UI.createTableViewRow({
	id: "iphone_person_row"
    });
    
    this.row.addEventListener("click", function(event) {
	self.follow(event);
    });
    
    this.icon = Ti.UI.createImageView({
	id: "iphone_person_row_icon",
        image: person.icon
    });
    this.row.add(this.icon);
    
    this.name = Ti.UI.createLabel({
	id: "iphone_person_row_name",
	text: person.name
    });
    this.row.add(this.name);
    
    this.account = Ti.UI.createLabel({
	id: "iphone_person_row_account",
	text: String.format("@%s %s", person.account, (person.message || ""))
    });
    this.row.add(this.account);
    
    this.checked = Ti.UI.createImageView({
	id: "iphone_person_row_checked",
	visible: false
    });
    this.row.add(this.checked);
};
PersonRow.prototype = new Friends.PersonRow();


var FriendsWindow = {};
exports.FriendsWindow  = FriendsWindow;

FriendsWindow.createWindow = function(follow_me_now, options) {
    var window = Titanium.UI.createWindow(options);
    
    var list = PullToRefresh.createTableView({
        id: "iphone_friends_list",
        data: [{title:L("loading", "Loading...")}]
    });
    window.add(list.view);
    
    list.view.addEventListener("reload", function(e) {
        follow_me_now.load_nearby()
	    .success(function() {
	        list.setLastUpdated();
	        list.reloadEnd();
	    })
	    .failure(function(message) {
	        list.reloadEnd();
	        var alert = Ti.UI.createAlertDialog({
		    title: L("load_error", "Load error"),
		    message: message || "",
		    buttonNames: [L('ok', "OK")]
	        });
	        alert.show();
	    });
    });
    
    follow_me_now.addEventListener("loaded_nearby", function(event) {
        list.view.setData(event.people.map(function(person) {
	    return (new PersonRow(follow_me_now, person)).row;
        }));
    });
    
    window.addEventListener("focus", function() {
	follow_me_now.location.active();
    });
    
    window.addEventListener("blur", function() {
        follow_me_now.location.deactive();
    });
    
    return window;
};