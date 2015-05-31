var sqlite3 = require('sqlite3');

function createDb(callback) {
  var db = new sqlite3.Database(':memory:');
  var tablesCreated = 0;
  var incrTblCount = function(err) { if (err === null) tablesCreated++; };

  db.run("CREATE TABLE employees (employee_id TEXT, birthdate TEXT, " +
         "firstname TEXT, lastname TEXT, sex TEXT, start_date TEXT)", incrTblCount);
  db.run("CREATE TABLE salaries (employee_id TEXT, " +
         "salary TEXT, start_of_salary TEXT, end_of_salary TEXT)", incrTblCount);

  if (tablesCreated !== 0) return null;

  return db;
}

function closeDb(db) {
  try {
    db.close();
  } catch (e) {
    //db in use? already closed?
    //anyway, doesn't matter in the context of in-memory temp db
    return;
  }
}

function insertListAsRows(db, list, tableName, res) {
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
        res.status(500).json({ data: 'All cells must have data' });
        return;
      }
    }
    db.run(statementStr, queryCallback);
  }
}

//Completion callback for query is render(Array)
function createEmpList(db, render) {
  var empList = [];

  db.each("SELECT * FROM employees",
    function(err, row) {
      empList.push(row);
    },
    function(err, numRows) {
      render(empList);
  });
}

//First, name-query which has salaries-query as completion callback
//Second, salaries-query has render(String, Array) as a completion callback
function getEmployeeInfo(db, id, render) {
  var output = {name: null, salaries: []};

  var getSalaries = function(e, n) {
    db.each("SELECT salary, start_of_salary, end_of_salary " +
            "FROM salaries WHERE employee_id = '" + id + "' " +
            "ORDER BY CAST(start_of_salary as INTEGER) DESC",
      function(err, row) {
        var sal = Number(row.salary);
        var end = row.end_of_salary;

        //from http://stackoverflow.com/a/2866613
        sal = sal.toFixed(0).replace(/(\d)(?=(\d{3})+$)/g, "$1,");

        if (Date.now() < Date.parse(end)) end = 'Now';

        var salary = {salary: sal, start: row.start_of_salary, end: end};
        output.salaries.push(salary);
      },
      function(err, numRows) {
        render(output.name, output.salaries);
      }
    );
  };

  //get name
  db.each("SELECT firstname, lastname FROM employees WHERE employee_id = '" +
          id + "' LIMIT 1 ",
    function(err, row) {
      output.name = row.lastname + ', ' + row.firstname;
    },
    getSalaries
  );
}

function countRows(table) {
  var count = 0;

  db.each("SELECT COUNT(*) as num FROM " + table, function(err, row) {
    if (err) count = -1;
    else count = row.num;
  });

  return count;
}

module.exports = {
  createDb: createDb,
  closeDb: closeDb,
  insertListAsRows: insertListAsRows,
  createEmpList: createEmpList,
  getEmployeeInfo: getEmployeeInfo,
  countRows: countRows
};
