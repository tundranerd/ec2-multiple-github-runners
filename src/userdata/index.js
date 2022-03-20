const windowsUserdata = require('./windows.js');

const map = {
  windows: windowsUserdata
}

const getUserData = (os, label, createRegistrations) => {
  if(os in map) {
    return map[os](label, createRegistrations);
  }
  throw new Error(`Unsupported operating system ${os}`);
};

module.exports = {
  getUserData
}
