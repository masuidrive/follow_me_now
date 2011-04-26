var Friends = require("friends");

var PersonRow = function(follow_me_now, person) {
    var self = this;
    this.follow_me_now = follow_me_now;
    this.person = person;
    
    this.row = Ti.UI.createTableViewRow({
        className: "android_person_row"
    });
    
    this.row.addEventListener("click", function(event) {
        self.follow(event);
    });
    
    this.icon = Ti.UI.createImageView({
        className: "android_person_row_icon",
        image: person.icon
    });
    this.row.add(this.icon);
    
    this.name = Ti.UI.createLabel({
        className: "android_person_row_name",
        text: person.name
    });
    this.row.add(this.name);
    
    this.account = Ti.UI.createLabel({
        className: "android_person_row_account",
        text: String.format("@%s %s", person.account, (person.message || ""))
    });
    this.row.add(this.account);

    this.checked = Ti.UI.createImageView({
        className: "android_person_row_checked",
        visible: false
    });
    this.row.add(this.checked);
};
PersonRow.prototype = new Friends.PersonRow();

var ReloadRow = function(callback) {
    var self = this;
    this.row = Ti.UI.createTableViewRow({
        className: "android_reload_row"
    });
    this.row.addEventListener("click", callback);
    
    this.label = Ti.UI.createLabel({
        className: "android_reload_label",
        text: L("reload", "Reload")
    });
    this.row.add(this.label);
};

ReloadRow.prototype.reload = function() {
    this.label.text = L("reload", "Reload");
};

ReloadRow.prototype.loading = function() {
    this.label.text = L("loading", "Loading...");
};

var FriendsWindow = {};
exports.FriendsWindow  = FriendsWindow;

FriendsWindow.createWindow = function(follow_me_now, options) {
    var window = Titanium.UI.createWindow(options);
    
    var list = Ti.UI.createTableView({
        className: "android_friends_list",
        data: [{title:L("loading", "Loading...")}]
    });
    window.add(list);
    
    var reload = function() {
        reloadRow.loading();
        follow_me_now.load_nearby()
            .success(function(message) {
                reloadRow.reload();
            })
            .failure(function(message) {
                reloadRow.reload();
                var alert = Ti.UI.createAlertDialog({
                    title: L("load_error", "Load error"),
                    message: message || "",
                    buttonNames: [L('ok', "OK")]
                });
                alert.show();
            });
    };
    var reloadRow = new ReloadRow(reload);
        
    follow_me_now.addEventListener("loaded_nearby", function(event) {
        var data = event.people.map(function(person) {
            return (new PersonRow(follow_me_now, person)).row;
        });
        data.unshift(reloadRow.row);
        list.setData(data);
        Ti.API.info("loaded");
    });
    
    window.addEventListener("focus", function() {
        follow_me_now.location.active();
    });
    
    window.addEventListener("blur", function() {
        follow_me_now.location.deactive();
    });
    
    return window;
};
