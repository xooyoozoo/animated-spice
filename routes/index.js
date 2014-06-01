/**
 * Basic route controller
 */
var pages = require('./pages');

module.exports = function(app) {
    app.get('/', pages.index);
};