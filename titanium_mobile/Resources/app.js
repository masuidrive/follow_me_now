var follow_me_now = require('followmenow').createFollowMeNow(
    'App key',
    'Secret key'
);

var js = 'friends_iphone';
if(Ti.Platform.osname == 'android') {
    js = 'friends_android';
}
var FriendsWindow = require(js).FriendsWindow;

var tabGroup = Titanium.UI.createTabGroup();

var friends_window = FriendsWindow.createWindow(follow_me_now,{
    id: 'friends_window'
});

var tab1 = Titanium.UI.createTab({
    id: 'friends_tab',
    window: friends_window
});
tabGroup.addTab(tab1);

var info_window = Titanium.UI.createWindow({
    id: 'info_window',
    url: 'info.js'
});

var tab2 = Titanium.UI.createTab({
    id: 'info_tab',
    window: info_window
});
tabGroup.addTab(tab2);

var openWelcome = function(callback) {
    var window = Ti.UI.createWindow({
            id: 'welcome_window'
    });
    var webview = Ti.UI.createWebView({
            url: 'welcome.html'
    });
    window.add(webview);
    window.open();
    
    var func = function() {
            Ti.App.removeEventListener('signin_twitter', func);
            callback();
            setTimeout(function() {
                window.close();
            }, 500);
    };
    Ti.App.addEventListener('signin_twitter', func);
};

var func = function() {
    follow_me_now.connect()
        .success(function() {
            tabGroup.open();
            follow_me_now.load_nearby()
                    .failure(function(message) {
                        var alert = Ti.UI.createAlertDialog({
                        title: L("error", "Error"),
                        message: message,
                        buttonNames: [L('ok', "OK")]
                    });
                    alert.show();
                });
        })
        .failure(function(message) {
            var alert = Ti.UI.createAlertDialog({
                title: L("error", "Error"),
                message: message,
                buttonNames: [L('ok', "OK")]
            });
            alert.show();
            func();
        });
};

if(follow_me_now.is_authorized()) {
    func();
}
else {
    openWelcome(func);
}
