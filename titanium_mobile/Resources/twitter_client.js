var OAuth = require("oauth").OAuth;
var Promise = require("promise").Promise;
var utils = require("utils");

var OAuthConditions = function(consumerKey, consumerSecret) {
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.signatureMethod = "HMAC-SHA1";
    
    this.requestToken = undefined;
    this.requestTokenSecret = undefined;
    this.accessToken = undefined;
    this.accessTokenSecret = undefined;
    this.pin = undefined;
};

OAuthConditions.prototype.save = function(name) {
    var data = JSON.stringify({
        requestToken : this.requestToken,
        requestTokenSecret : this.requestTokenSecret,
        accessToken : this.accessToken,
        accessTokenSecret : this.accessTokenSecret,
        pin : this.pin
    });
    Ti.App.Properties.setString("oauth_conditions_"+(name || "noname"), data);
};

OAuthConditions.prototype.load = function(name) {
    try {
        var data = JSON.parse(Ti.App.Properties.getString("oauth_conditions_"+(name || "noname")));
        this.requestToken = data.requestToken;
        this.requestTokenSecret = data.requestTokenSecret;
        this.accessToken = data.accessToken;
        this.accessTokenSecret = data.accessTokenSecret;
        this.pin = data.pin;
    }
    catch(e) {
        // NOOP
    }
};

var TwitterClient = function(consumerKey, consumerSecret) {
    this.oAuthConditions = new OAuthConditions(consumerKey, consumerSecret);
    this.oAuthConditions.load();
    
    this.accessor = {
        consumerSecret: consumerSecret,
        tokenSecret: ""
    };
};
exports.TwitterClient = TwitterClient;

TwitterClient.prototype.is_authorized = function() {
    return(typeof this.oAuthConditions.accessTokenSecret != "undefined");
};

TwitterClient.prototype.openAuthWindow = function(params) {
    var self = this;
    
    var promise = new Promise();
    if(typeof params == "undefined") {
        params = {};
    }
    this.window = Ti.UI.createWindow({
        title: params.title || L("sign_in_with_twitter", "Sign in with Twitter"),
        modal: true
    });
    this.webView = Ti.UI.createWebView({
        // require for escaping iOS bug
        // https://appcelerator.lighthouseapp.com/projects/32238/tickets/1233-webview-crashes-on-twitter-oauth-pin-page-132
        autoDetect:[Ti.UI.AUTODETECT_NONE]
    });
    
    this.window.add(this.webView);
    
    var button = Ti.UI.createButton({
        title: L("top", "Top")
    });
    
    button.addEventListener("click", function() {
        self.authorizing = false;
        self.webView.url = self.authUrl;
    });
    this.window.leftNavButton = button;

    this.messageView = Titanium.UI.createView({
        height: 50,
        width: 180,
        borderRadius: 10,
        backgroundColor: "#000",
        opacity: 0.7,
        touchEnabled: false,
        visible: false
    });
    this.loadingLabel = Ti.UI.createLabel({
        text: L("loading", "Loading..."),
        textAlign: "center",
        font: { fontSize: 20, fontWeight: 'bold' },
        color: "#fff",
        visible: false
    });
    this.waitLabel = Ti.UI.createLabel({
        text: L("please_wait", "Please wait..."),
        textAlign: "center",
        font: { fontSize: 20, fontWeight: 'bold' },
        color: "#fff",
        visible: false
    });
    this.window.add(this.messageView);
    this.window.add(this.loadingLabel);
    this.window.add(this.waitLabel);
    
    this.webView.addEventListener("beforeload", function() {
        self.showLoading();
    });

    this.webView.addEventListener("load", function() {
        self.hideLoading();
    });
    
    this.window.open();

    this.authorize()
        .success(function() {
            self.window.close();
            promise.emitSuccess();
        })
        .failure(function() {
            promise.emitFailure();
        });
    
    return promise;
};

TwitterClient.prototype.showLoading = function() {
    this.messageView.show();
    this.loadingLabel.show();
    this.waitLabel.hide();
};

TwitterClient.prototype.hideLoading = function() {
    this.messageView.hide();
    this.loadingLabel.hide();
};

TwitterClient.prototype.showWait = function() {
    this.loadingLabel.hide();
    this.messageView.show();
    this.waitLabel.show();
};

TwitterClient.prototype.hideWait = function() {
    this.messageView.hide();
    this.waitLabel.hide();
};

TwitterClient.prototype.verifyAccount = function() {
    var promise = new Promise();
    var self = this;
    this.getAccessToken("https://api.twitter.com/oauth/access_token")
        .success(function() {
            self.send("GET", "http://api.twitter.com/1/account/verify_credentials.json")
                .success(function(data) {
                    Ti.App.Properties.setString("twitter", JSON.stringify(data));
                    Ti.App.Properties.setString("twitter[id]", data.id_str);
                    Ti.App.Properties.setString("twitter[screen_name]", data.screen_name);
                    promise.emitSuccess();
                })
                .failure(promise);
        })
        .failure(promise);
    return promise;
};

TwitterClient.prototype.authorize = function(success, failed) {
    var promise = new Promise();
    
    var self = this;
    var receivePin = function(e) {
        var oauth_pin = self.webView.evalJS("((document.getElementById(\"oauth_pin\") && document.getElementById(\"oauth_pin\").innerHTML) || \"\")");
        if(oauth_pin != "") {
            self.showWait();
            self.oAuthConditions.pin = oauth_pin;
            self.verifyAccount()
                .success(function() {
                    self.hideWait();
                    self.oAuthConditions.save();
                    promise.emitSuccess();
                })
                .failure(function(error) {
                    self.hideWait();
                    promise.emitFailure(error);
                });
        }
    };
    
    this.getRequestToken("https://api.twitter.com/oauth/request_token")
        .success(function(parameter) {
            self.authUrl = "https://api.twitter.com/oauth/authorize?" + parameter;
            self.webView.url = self.authUrl;
            self.webView.addEventListener("load", receivePin);
        })
        .failure(promise);
    
    return promise;
};

TwitterClient.prototype.getRequestToken = function(url) {
    var promise = new Promise();
    
    this.accessor.tokenSecret = "";
    var message = this.createMessage(url);
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, this.accessor);
    
    var self = this;
    var client = Ti.Network.createHTTPClient({
        timeout: 10*1000,
        onload: function(response) {
            if(client.status == 200) {
                var responseParams = OAuth.getParameterMap(client.responseText);
                if(typeof responseParams.oauth_token == "undefined") {
                    promise.emitFailure();
                }
                else {
                    self.oAuthConditions.requestToken = responseParams.oauth_token;
                    self.oAuthConditions.requestTokenSecret = responseParams.oauth_token_secret;
                    promise.emitSuccess(client.responseText);
                }
            }
            else {
                promise.emitFailure(client.responseText);
            }
        },
        onerror: function(e) {
            promise.emitFailure(L("cant_get_auth_token", "Can't get auth token"));
        }
    }); 
    
    client.open("POST", url);
    client.send(utils.query_string(OAuth.getParameterList(message.parameters)));
    
    return promise;
};

TwitterClient.prototype.getAccessToken = function(url) {
    var promise = new Promise();
    
    this.accessor.tokenSecret = this.oAuthConditions.requestTokenSecret;
    
    var message = this.createMessage(url);
    message.parameters.push(["oauth_token", this.oAuthConditions.requestToken]);
    message.parameters.push(["oauth_verifier", this.oAuthConditions.pin]);
    
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, this.accessor);
    var self = this;
    var client = Ti.Network.createHTTPClient({
        timeout: 10 * 1000, // 10sec
        onload: function(response) {
            var responseParams = OAuth.getParameterMap(client.responseText);
            if(typeof responseParams.oauth_token == "undefined") {
                promise.emitFailure(L("twitter_server_error", "Twitter server error"));
            }
            else {
                self.oAuthConditions.accessToken = responseParams.oauth_token;
                self.oAuthConditions.accessTokenSecret = responseParams.oauth_token_secret;
                promise.emitSuccess(client.responseText);
            }
        },
        onerror: function(e) {
            promise.emitFailure(L("cant_access_to_server", "Can't access to server"));
        }
    });
    
    client.open("POST", url);
    client.send(utils.query_string(OAuth.getParameterList(message.parameters)));
    return promise;
};

TwitterClient.prototype.send = function(method, url, parameters) {
    var promise = new Promise();
        
    this.accessor.tokenSecret = this.oAuthConditions.accessTokenSecret;
    var message = this.createMessage(url, method);
    message.parameters.push(["oauth_token", this.oAuthConditions.accessToken]);
    if(parameters) {
        for (var p in parameters) {
            if(parameters.hasOwnProperty(p)) {
                message.parameters.push(parameters[p]);
            }
        }
    }
    OAuth.setTimestampAndNonce(message);
    OAuth.SignatureMethod.sign(message, this.accessor);
    
    var parameterMap = OAuth.getParameterList(message.parameters);
    var client = Ti.Network.createHTTPClient({
        timeout: 10 * 1000, // 10sec
        onload: function(event) {
            if (client.status == 200) {
                promise.emitSuccess(JSON.parse(client.responseText));
            }
            else {
                var message = L("cant_access_to_server", "Can't access to server");
                try {
                    message = JSON.parse(client.responseText).error;
                }
                catch(e) {
                    // NOOP
                }
                promise.emitFailure(message);
            }
        },
        onerror: function(e) {
            var message = L("cant_access_to_server", "Can't access to server");
            try {
                message = JSON.parse(e.source.responseText).error;
            }
            catch(e) {
                // NOOP
            }
            promise.emitFailure(message);
        }
    });
    
    if(method == "GET") {
        client.open(method, url+"?"+utils.query_string(parameterMap));
        client.send();
    }
    else {
        client.open(method, url);
        client.send(utils.query_string(OAuth.getParameterMap(message.parameters)));
    }
    return promise;
};

TwitterClient.prototype.createMessage = function(url, method) {
    return({
        action: url,
        method: method || "POST",
        parameters: [
            ["oauth_consumer_key", this.oAuthConditions.consumerKey],
            ["oauth_signature_method", this.oAuthConditions.signatureMethod]
        ]
    });
};
