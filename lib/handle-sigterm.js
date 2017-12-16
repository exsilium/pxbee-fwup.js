const readLine = require('readline');

let calledOnce = false;
if (process.platform === 'win32') {
  const rl = readLine.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}

process.once('SIGINT', () => {
  if (calledOnce) {
    process.exit();
  } else {
    calledOnce = true;
    console.log('');
    console.log('Interrupt detected!'.underline.red + ' Interrupt again to confirm, may cause issues during firmware upload!'.yellow);
  }
});
