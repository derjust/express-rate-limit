'use strict';
var defaults = require('defaults');

function RateLimit(options) {


    // this is shared by all endpoints that use this instance
    var hits = {};

    options = defaults(options, {
        // window, delay, and max apply per-ip unless global is set to true
        windowMs: 60 * 1000, // miliseconds - how long to keep records of requests in memory
        delayMs: 1000, // milliseconds - base delay applied to the response - multiplied by number of recent hits from user's IP
        delay: 4, // number of recent connection `window` miliseconds before delayMs is applied
        max: 5, // max number of recent connections during `window` miliseconds before sending a 400 response
        global: false, // if true, IP address is ignored and setting is applied equally to all requests
        skipHeaders: false // if true, no X-RateLimit* headers are sent
    });

    return function rateLimit(req, res, next) {
        var ip = options.global ? 'global' : req.ip;
        options.delay = Math.min(options.delay, options.max); //ensure that the delay only happens before the blocking

        if (typeof hits[ip] !== "number") {
            hits[ip] = 0; // first one's free ;)
        } else {
            hits[ip]++;
        }

        setTimeout(function() {
            // cleanup
            hits[ip]--;
            if (hits[ip] <=0 ) {
                delete hits[ip];
            }
        }, options.windowMs);

        if (hits[ip] >= options.max) {
            if (!options.skipHeaders) {
                var retryAfter = Math.floor((hits[ip] - options.max) * (windowMs / 1000)); //seconds until we are below options.max again
                res.set('Retry-After', retryAfter);
            }
            
            // 429 status = Too Many Requests (RFC 6585)
            return res.status(429).end('Too many requests, please try again later.');
        } 
        
        if (!options.skipHeaders) {
            res.set('X-RateLimit-Limit', options.max);
            res.set('X-RateLimit-Remaining', options.max - (hits[ip] ? hits[ip] : 0));
        }
        
        if (hits[ip] >= options.delay) {
            var delay = hits[ip] * options.delayMs;
            setTimeout(next, delay);
        } else {
            next();
        }
    };
}

module.exports = RateLimit;