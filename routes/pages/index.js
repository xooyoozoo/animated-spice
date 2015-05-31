/*
 * GET hello world home page.
 */
var csvParse = require('csv-parse');
var formidable = require('formidable');
var fs = require('fs');
var sql = require('../../public/js/sqlite.js');

var expectedparsedTblCols = {employees: ['employee_id', 'birthdate', 'firstname',
                                      'lastname', 'sex', 'start_date'],
                          salaries: ['employee_id', 'salary',
                                     'start_of_salary', ' end_of_salary']
                         };

/*
Stores temporary unique database per unique user,
but it may be more elegant to do single db with table names ('type'+'uniqueID')
*/
// { 'randomIdStr': {db: sqlObject, created: date} , ...}
var userDatabases = {};

//from http://stackoverflow.com/a/19964557
function randomIdStr(len) {
  var randId = (Math.random().toString(36)+'00000000000000000').slice(2, len+2);
  if (randId == 0) return randomIdStr(len); //stops small chance of '00000'

  return randId;
}

function initialize(req, res) {
  if (hasStoredUserData(req)) {
    userDatabases[req.session.id].db.close();
    delete userDatabases[req.session.id];
  }

  var userId = randomIdStr(8);
  var user = {db: sql.createDb(), created: Date.now()};

  req.session.id = userId;
  userDatabases[userId] = user;

  res.render('index', {
    title: 'Upload Page',
    layout: 'layout'
  });
}

function upload(req, res) {
  var uploader = new formidable.IncomingForm();
  var csvParser = csvParse({skip_empty_lines: true});

  var tableName = null;
  var tableCols = null;
  var parsedTbl = [];

  var db = req.db;

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
        res.status(500)
           .json({ data: 'File must be CSV with ' + tableCols.length + ' columns'});
      } else {

        sql.insertListAsRows(db, parsedTbl, tableName, res);
      }

    });

  uploader
    .on('error', function(err) {
      res.status(500).json({ data: 'Unknown server error occured during upload'});
    })
    .on('file', function (field, file) {
      tableName = field;
      tableCols = expectedparsedTblCols[tableName];

      if (file.type !== 'text/csv') {
        res.status(500).json({ data: 'File must be in CSV format'});
      } else {
        fs.createReadStream(file.path).pipe(csvParser);
      }
    });

  uploader.parse(req);
}

function listEmployees(req, res) {
  var render = function(res, empList) {
    res.render('employees', {
      empList: empList,
      title: 'Employees Page',
      layout: 'layout'
    });
  };

  sql.createEmpList(req.db, render.bind(this, res));
}

function showSalaryHist(req, res) {
  var render = function(res, name, salaries) {
    res.render('salaries', {
      name: name,
      salaryList: salaries,
      title: 'Salary History Page for ' + name,
      layout: 'layout'
    });
  };

  sql.getEmployeeInfo(req.db, req.params.id, render.bind(this, res));
}

function hasStoredUserData(req) {
  var sess = req.session;
  if ('id' in sess && sess.id in userDatabases) return true;
  else return false;
}

function passAlongDb(req, res, next) {
  var sess = req.session;

  if (hasStoredUserData(req)) {
    req.db = userDatabases[sess.id].db;
    next();
  } else {
    res.redirect('/');
  }
}

module.exports = {
  index: initialize,

  upload: [passAlongDb, upload],
  listEmployees: [passAlongDb, listEmployees],
  showSalaryHist: [passAlongDb, showSalaryHist]
};