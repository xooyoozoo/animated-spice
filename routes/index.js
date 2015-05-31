/**
 * Basic route controller
 */
var pages = require('./pages');
var sql = require('../public/js/sqlite.js');

module.exports = function(app) {
  app.get('/', pages.index);
  app.post('/', pages.upload);

  app.get('/employees/', pages.listEmployees);
  app.get('/employees/:id', pages.showSalaryHist);
};