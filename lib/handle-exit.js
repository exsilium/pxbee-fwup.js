module.exports = function handleExit(port) {
  if(port.readable) {
    port.close();
  }
  process.exit();
}
