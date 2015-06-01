/**
 * Basic route controller
 */
var sql = require('../public/js/sqlite.js');
var csvParse = require('csv-parse');
var formidable = require('formidable');
var fs = require('fs');

var expectedParsedData = {employees: ['employee_id', 'birthdate', 'firstname',
                                      'lastname', 'sex', 'start_date'],
                          salaries: ['employee_id', 'salary',
                                     'start_of_salary', ' end_of_salary']
                         };

/*
Stores temporary unique database per unique user with last access time.
It may be more efficient to do single db with unique userID table names,
though this way allows very straightforward way of deleting old/unneeded data
*/
// { 'randomIdStr': {db: sqlObject, created: date} , ...}
var userDatabases = {};

//Random string generator from http://stackoverflow.com/a/19964557
function randomIdStr(len) {
  var randId = (Math.random().toString(36)+'00000000000000000').slice(2, len+2);
  if (randId == '0') return randomIdStr(len); //stops small chance of '00000'

  return randId;
}

/*
Initial entry point into the app.
Sets up a ID for user and the user's database with expected tables and columns.
 */
function initialize(req, res, next) {
  if (hasValidUserId(req)) {
    //Assumes that going back to the main page == restarting the app
    //so we can delete old data while we're at it.
    userDatabases[req.session.id].db.close();
    delete userDatabases[req.session.id];
  }

  var userId = randomIdStr(8);
  var user = {db: sql.createDb(), lastAccessed: Date.now()};

  //If database object was not created, that's a big problem!
  if (!user.db) {
    next(new Error());
  }

  req.session.id = userId;
  userDatabases[userId] = user;

  res.render('index', {
    title: 'Upload Page',
    layout: 'layout'
  });
}

/*
Formdiable is used to send file into fs, which pipes into csv-parse,
which creates an array of arrays.
Metadata (stored in expectedParsedData) about the expected files is used
to validate the data
 */
function upload(req, res, next) {
  var uploader = new formidable.IncomingForm();
  var csvParser = csvParse({skip_empty_lines: true});

  var tableName = null;
  var tableCols = null;
  var parsedTbl = [];

  var db = req.db;

  uploader
    .on('error', function(err) {
      res.status(400).json({ data: 'Unknown server error occured during upload'});
    })
    .on('file', function (field, file) {
      tableName = field;
      tableCols = expectedParsedData[tableName];

      if (file.type !== 'text/csv') {
        res.status(400).json({ data: 'File must be in CSV format'});
      } else {
        fs.createReadStream(file.path).pipe(csvParser);
      }
    });

  csvParser
    .on('readable', function() {
      while (record = csvParser.read()) {
        parsedTbl.push(record);
      }
    })
    .on('error', function(err) {
      res.status(500).json({ data: err.message});
    })
    .on('finish', function() {
      if (parsedTbl[0].length !== tableCols.length) {
        res.status(400)
           .json({ data: 'File must be CSV with ' + tableCols.length + ' columns'});
      } else {
        db.insertListAsRows(parsedTbl, tableName, res);
      }

    });

  uploader.parse(req);
}

/*
Query db for data needed for rendering. Passes the renderer as a callback.
 */
function listEmployees(req, res, next) {
  var render = function(res, next, err, empList) {
    if (err) {
      next(err);
    }
    //else
    res.render('employees', {
      empList: empList,
      title: 'All Employees',
      layout: 'layout'
    });
  };

  req.db.createEmpList(render.bind(this, res, next));
}

function showSalaryHist(req, res, next) {
  var render = function(res, next, err, name, salaries) {
    if (err) {
      next(err);
    }
    //else
    res.render('salaries', {
      name: name,
      salaryList: salaries,
      title: 'Salary History Page for ' + name,
      layout: 'layout'
    });
  };

  req.db.getEmployeeSal(req.params.id, render.bind(this, res, next));
}

/*
Makes sure user has the ID generated during the first app usage
and the ID is still known by the app.
The result is used to determine whether to redirect back to the main page.
 */
function hasValidUserId(req) {
  var sess = req.session;
  if ('id' in sess && sess.id in userDatabases) return true;
  else return false;
}

/*
If everything is hunky-dory, store a db reference in the request
and update usage time for the current user.
This is done for most pages to make sure there's a database to work with.
 */
function passAlongDb(req, res, next) {
  var sess = req.session;
  if (hasValidUserId(req) &&
    //Accessing old pages from browser history seems to do weird things
    //The referer check appears to prevent that
    req.get('Referer') !== undefined)
  {
    req.db = userDatabases[sess.id].db;
    userDatabases[sess.id].lastAccessed = Date.now();
    next();
  } else {
    res.redirect('/');
  }
}

module.exports = function(app) {
  app.get('/', initialize);
  app.post('/', [passAlongDb, upload]);

  app.get('/employees/', [passAlongDb, listEmployees]);
  app.get('/employees/:id', [passAlongDb, showSalaryHist]);

  app.get('*', function(req, res, next) {
    res.redirect('/');
  });

  app.use(function(err, req, res, next) {
    var mssg = err.message || 'Error!';
    res.end("<html>"+mssg+"<br><br><a href='/'>Start over?</a></html>");
    //res.redirect('/');
  });
};