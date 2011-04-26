var query_string = function(parameters) {
    if(parameters instanceof Array) {
	return parameters.map(function(v) {
	    return Ti.Network.encodeURIComponent(v[0])+"="+Ti.Network.encodeURIComponent(v[1]);
	}).join("&");
    }
    var array = [];
    for (var key in parameters) {
	if(parameters.hasOwnProperty(key)) {
	    array.push([key, parameters[key]]);
	}
    }
    return query_string(array);
};
exports.query_string = query_string;