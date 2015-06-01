function upload() {
  var tableName = this.parentNode.id;

  var button = this;
  var uploadEl = document.getElementById(tableName + 'File');
  var progress = document.getElementById(tableName + 'Progress');

  if (uploadEl.files.length !== 1) {
    alert("Please select a single file for " + tableName);
    return;
  }

  var data = new FormData();
  data.append(tableName, uploadEl.files[0]);

  var req = new XMLHttpRequest();
  req.onreadystatechange = function() {
    if (req.readyState == 4) {
      var res = { data: null };
      try {
        res = JSON.parse(req.response);
      } catch(err) {
        res = {
          data: req.responseText
        };
      }

      if (req.status == 400 || req.status == 500) {
        progress.innerHTML = 'Error: ' + res.data + '.  Try again!';
      } else if (req.status === 200) {
        button.style.visibility = 'hidden';

        delete uploadsLeft[tableName];
        if (Object.keys(uploadsLeft).length === 0) {
          window.location.href = "/employees/";
        }
      }
    }
  };

  req.upload.addEventListener('progress', function(e) {
    var percentDone = Math.floor(e.loaded/e.total) * 100;
    progress.innerHTML = percentDone + '% uploaded';
  });

  req.open('POST', '/');
  req.send(data);

}

var submitters = document.getElementsByClassName('uploader');
var uploadsLeft = {employees: '', salaries: ''};

for (var i = 0; i < submitters.length; i++) {
  var button = document.getElementById(submitters[i].id + 'Button');
  button.addEventListener('click', upload);
}

