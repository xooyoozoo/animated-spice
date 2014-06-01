/**
 * Basic route controller
 */
var index = require('./index');

module.exports = function(app) {
    app.get('/', index.index);
};