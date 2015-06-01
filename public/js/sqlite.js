var sqlite3 = require('sqlite3');

/*
Returns a new database for a user. Tables are pre-created with the expected setup.

Returned database object has the other querying methods pre-appended
*/
function createDb(callback) {
  var db = new sqlite3.Database(':memory:');
  var tablesCreated = 0;
  var incrTblCount = function(err) { if (err === null) tablesCreated++; };

  db.run("CREATE TABLE employees (employee_id TEXT, birthdate TEXT, " +
         "firstname TEXT, lastname TEXT, sex TEXT, start_date TEXT)", incrTblCount);
  db.run("CREATE TABLE salaries (employee_id TEXT, " +
         "salary TEXT, start_of_salary TEXT, end_of_salary TEXT)", incrTblCount);

  if (tablesCreated !== 0) return null;

  db.closeDb = closeDb;
  db.insertListAsRows = insertListAsRows;
  db.createEmpList = createEmpList;
  db.getEmployeeSal = getEmployeeSal;

  return db;
}

function closeDb() {
  try {
    this.close();
  } catch (e) {
    //db in use? already closed?
    //anyway, doesn't matter in the context of in-memory temp db
    return;
  }
}

function insertListAsRows(list, tableName, res) {
  var db = this;
  var numRows = list.length;
  var queryCallback = function(err) {
    numRows--;
    if (err) {
      res.status(500).json({ data: err.message});
    } else if (numRows === 0) {
      res.status(200).json({ data: 'Uploaded ' + tableName});
    }
  };

  for (var i = 0; i < numRows; i++) {
    var row = list[i];
    var statementStr = "INSERT INTO " + tableName +
                       " VALUES ('" + row.join("', '") + "')";

    for (var j = 0; j < row.length; j++) {
      if (row[j] === '' || row[j] === null) {
        res.status(400).json({ data: 'All cells must have data' });
        return;
      }
    }
    db.run(statementStr, queryCallback);
  }
}

//Completion callback for query is render(Array)
function createEmpList(render) {
  var db = this;
  var empList = [];

  db.each("SELECT * FROM employees",
    function(err, row) {
      empList.push(row);
    },
    function(err, numRows) {
      render(err, empList);
  });
}

//First, name-query which has salaries-query as completion callback
//Second, salaries-query has render(String, Array) as a completion callback
function getEmployeeSal(id, render) {
  var db = this;
  var output = {name: null, salaries: []};

  var getSalaries = function(e, n) {
    db.each("SELECT salary, start_of_salary, end_of_salary " +
            "FROM salaries WHERE employee_id = '" + id + "' " +
            "ORDER BY CAST(start_of_salary as INTEGER) DESC",
      function(err, row) {
        var sal = Number(row.salary);
        var end = row.end_of_salary;

        //Thousands separator formatting from http://stackoverflow.com/a/2866613
        sal = sal.toFixed(0).replace(/(\d)(?=(\d{3})+$)/g, "$1,");

        if (Date.now() < Date.parse(end)) end = 'now';

        var salary = {salary: sal, start: row.start_of_salary, end: end};
        output.salaries.push(salary);
      },
      function(err, numRows) {
        var error = err || e;
        render(error, output.name, output.salaries);
      }
    );
  };

  //get name from employee_id
  db.each("SELECT firstname, lastname FROM employees WHERE employee_id = '" +
          id + "' LIMIT 1 ",
    function(err, row) {
      output.name = row.lastname + ', ' + row.firstname;
    },
    getSalaries
  );
}

module.exports = {
  createDb: createDb
};
