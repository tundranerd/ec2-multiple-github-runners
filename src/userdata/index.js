const { getUserData: windowsUserdata } = require('./windows.js');
const { getUserData: linuxUserdata } = require('./linux.js');

const map = {
  windows: windowsUserdata,
  linux: linuxUserdata
}

const getUserData = async (os, label, createRegistrations) => {
  if(os in map) {
    return await map[os](label, createRegistrations);
  }
  throw new Error(`Unsupported operating system ${os}`);
};

module.exports = {
  getUserData
}
