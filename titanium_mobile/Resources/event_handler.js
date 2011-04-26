var EventHandler = function() {};
exports.EventHandler = EventHandler;
EventHandler.prototype.addEventListener = function(name, callback) {
    if(typeof this._events=='undefined') {
	    this._events = {};
	    this._events[name] = [callback];
    }
    else if(typeof this._events[name]=='undefined') {
	    this._events[name] = [callback];
    }
    else {
	    this._events[name].push(callback);
    }
};

EventHandler.prototype.removeEventListener = function(name, callback) {
    if(typeof this._events != 'undefined' && typeof this._events[name] != 'undefined') {
	    this._events = this._events.filter(function(callback2) {
	        return callback == callback2;
	    });
    }
};

EventHandler.prototype.fireEvent = function(name, param) {
    if(typeof this._events != 'undefined' && typeof this._events[name] != 'undefined') {
	    this._events[name].forEach(function(callback) {
	        try {
		        callback(param);
	        }
	        catch(e) {
		        Ti.API.error(e);
	        }
	    });
    }
};
