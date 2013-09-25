// example/services.js
// The services provided by this application

module.exports = {
  emailToList: emailToList,
  addEmailToList: addEmailToList,
}

var lists = {};

function emailToList(task, done) {
  // This will fail the first time. Expected
  if (!lists[task.list])
    return done(new Error('list is invalid'))

  console.log('EMAIL: ' + task.list + ' (' + lists[task.list].join(', ') + '): ' + task.subject + ' // ' + task.body);
  done();
}

function addEmailToList(task, done) {
  lists[task.list] = (lists[task.list] || []).concat(task.email);
  done();
}