
var twitter = require("twitter_client");
var EventHandler = require("event_handler").EventHandler;
var Promise = require("promise").Promise;
var utils = require("utils");

var LocationManager = function() {
    this.current_location = undefined;
    this.promises = [];
    Ti.Geolocation.purpose = L("send_current_location", "Send current location");
};

// Ti.Geolocation.watchPosition // DON"T REMOVE THIS LINE FOR Android ISSUE!
LocationManager.prototype.active = function() {
    this.deactive();
    var self = this;
    this.__location_listener = function(event) {
        if(event.success) {
            self.current_location = event.coords;
            var promises = self.promises;
            self.promises = [];
            setTimeout(function(){
                promises.forEach(function(promise) {
                    promise.emitSuccess(self.current_location);
                });
            }, 0);
        }
    };
    Ti.Geolocation.addEventListener("location", this.__location_listener);
};

LocationManager.prototype.deactive = function() {
    if(this.__location_listener) {
        Ti.Geolocation.removeEventListener("location", this.__location_listener);
        this.__location_listener = undefined;
    }
};

LocationManager.prototype.position = function() {
    var promise = new Promise();
    if(!Ti.Geolocation.locationServicesEnabled) {        
        promise.emitFailure("cant_connect_to_server", "Can't access to GPS");
    }
    else if(this.current_location) {
        promise.emitSuccess(this.current_location);
    }
    else {
        this.promises = [promise];
    }
    return promise;
};


var FollowMeNow = function(consumerKey, ConsumerSecret) {
    this.twitter = new twitter.TwitterClient(consumerKey, ConsumerSecret);
    this.location = new LocationManager();
};
FollowMeNow.prototype = new EventHandler();

FollowMeNow.prototype.showAuthWindow = function() {
    return this.twitter.openAuthWindow();
};

FollowMeNow.prototype.is_authorized = function() {
    return this.twitter.is_authorized();
};

FollowMeNow.prototype.connect = function() {
    if(this.is_authorized()) {
        var promise = new Promise();
        promise.emitSuccess();
        return promise;
    }
    else {
        return this.showAuthWindow();
    }
};

FollowMeNow.prototype.load_nearby = function(list) {
    var promise = new Promise();
    var self = this;
    this.location.position()
        .success(function(position) {
            var http = Ti.Network.createHTTPClient({
                timeout: 10 * 1000, // 10 sec
                onload: function() {
                    var json = JSON.parse(this.responseText);
                    self.fireEvent("loaded_nearby", {people: json.people});
                    promise.emitSuccess();
                },
                onerror: function() {
                    promise.emitFailure(L("cant_connect_to_server", "Can't connect to server"));
                }
            });
            var query = [["latitude", position.latitude],
                         ["longitude", position.longitude],
                         ["accuracy", position.accuracy],
                         ["twitter_access_token", self.twitter.oAuthConditions.accessToken],
                         ["twitter_access_secret", self.twitter.oAuthConditions.accessTokenSecret],
                         ["twitter_user_id", Ti.App.Properties.getString("twitter[id]")]
                        ];
            
            http.open("GET", "http://followmenow-masuidrive.appspot.com/checkin?"+utils.query_string(query));
            //http.open("GET", "http://masuidrive.jp/tmp/followmenow.json?"+utils.query_string(query));
            //http.open("GET", "http://localhost/%7emasuidrive//followmenow.json?"+utils.query_string(query));
            http.send();
        })
        .failure(promise);
    
    return promise;
};

FollowMeNow.prototype.follow = function(name) {
    return this.twitter.send("POST", "https://api.twitter.com/1/friendships/create.json", [["screen_name", name]]);
};

exports.createFollowMeNow = function(consumerKey, ConsumerSecret) {
    return new FollowMeNow(consumerKey, ConsumerSecret);
};
