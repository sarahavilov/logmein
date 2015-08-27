/* globals self */
'use strict';
document.addEventListener('click', function (e) {
  if (e.target.id === 'window') {
    self.port.emit('window');
  }
  if (e.target.id === 'password') {
    self.port.emit('password');
  }
});
