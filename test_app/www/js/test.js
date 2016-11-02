const auth = require('./auth');
const cloud = require('./cloud');

auth.test()
  .then(finished);

function finished() {
  document.getElementById('test-finished').innerHTML = 'FINISHED';
}
