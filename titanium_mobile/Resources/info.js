var webView = Titanium.UI.createWebView({
    url: "info.html"
});
Titanium.UI.currentWindow.add(webView);

var activity = Ti.Android.currentActivity;
activity.onCreateOptionsMenu = function(e) {
    Ti.API.info("!!info");
};
