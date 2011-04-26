var Promise = function() {
    this.promise = {};
    this.hasFired = undefined;
    this.lastParameter = undefined;
};
exports.Promise = Promise;

Promise.prototype.emit = function(event, parameter) {
    if(typeof this.promise[event] != 'undefined') {
        this.promise[event].forEach(function(callback) {
            setTimeout(function(){
                callback(parameter);
            }, 0);
        });
    }
    this.hasFired = event;
    this.lastParameter = parameter;
    return this;
};

Promise.prototype.emitSuccess = function(parameter) {
    return this.emit('success', parameter);
};

Promise.prototype.emitFailure = function(parameter) {
    return this.emit('failure', parameter);
};

Promise.prototype.on = function(event, callback) {
    if(typeof callback != 'function') {
        var obj = callback;
        callback = function(parameter) {
            obj.emit(event, parameter);
        };
    }

    if(typeof this.promise[event] == 'undefined') {
        this.promise[event] = [callback];
    }
    else {
        this.promise[event].push(callback);
    }
    if(this.hasFired === event) {
        var parameter = this.lastParameter;
        setTimeout(function(){
            callback(parameter);
        }, 0);
    }
    return this;
};

Promise.prototype.success = function(callback) {
    return this.on('success', callback);
};

Promise.prototype.failure = function(callback, args) {
    return this.on('failure', callback);
};
