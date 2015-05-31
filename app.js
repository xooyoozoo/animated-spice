
/**
 * Module dependencies.
 */

var express = require('express');
var http = require('http');
var path = require('path');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'mustache');
app.engine('mustache', require('hogan-express'));

app.use(express.favicon());
//from http://stackoverflow.com/a/25016730
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.cookieParser());
app.use(express.cookieSession({
  key: 'datahero.sess',
  secret: 'dataheroRocks!'
}));
app.use(app.router);

require('./routes')(app);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

http.createServer(app).listen(app.get('port'), function() {
  console.log('Express server listening on port ' + app.get('port'));
});

