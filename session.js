var cookieParser = require("cookie-parser");
var cookieSession = require("cookie-session");
var memcached = require('memcached');
var shortid = require("shortid");

module.exports = session;

function session(express, options) {
	options = options || {};
	this.keys = options.keys || ["test"];
	this.maxAge = options.maxAge || 60 * 20 * 1000;
	this.token = options.token || "token";
	
	var memcachedServer = options.memcachedServer || null;
	
	this.initialSessionObject = options.initialSessionObject || {
		login_attempt : 0,
		id : 0
	};
	
	if (memcachedServer == null) {
		console.warn("no memcached server defined");
		return;
	}
	
	this.cache = new memcached(memcachedServer);
	this.reqUserKey = options.reqUserKey || "user";
	
	express.use(cookieSession({ name: 'session', keys: this.keys, maxAge: this.maxAge }));
	express.use(cookieParser());
}

session.prototype = {
	connect : function() {
		var t = this;
		return function(req, res, next) {
			
			if (typeof req.session[t.token] === "undefined") {
				req.session[t.token] = shortid.generate();
			}

			t.cache.get(req.session[t.token], function(err, response) {
				
				if (!response) {
					req[t.reqUserKey] = t.initialSessionObject;
					t.cache.set(req.session[t.token], JSON.stringify(req[t.reqUserKey]), (t.maxAge/1000), function(err, response) {
						if (err) 
							console.warn(err);
					});

				} else {
					req[t.reqUserKey] = JSON.parse(response);
					t.cache.touch(req.session[t.token], (t.maxAge/1000), function(err,response) {
						if (err) 
							console.warn(err);
					});
				}
				return next();
			});
		};
	}, 
	save : function(req, callback) {
		this.cache.set(req.session[this.token], JSON.stringify(req[this.reqUserKey]), this.maxAge, function(err, response) {
			if (typeof callback !== "undefined") {
				callback.call(undefined, err, response);
			}
		});
	}
};