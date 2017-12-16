let calledOnce = false;

if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

process.once('SIGINT', function () {
  if(calledOnce){
    process.exit();
  }else{
    calledOnce = true;
    console.log('');
    console.log('Interrupt detected!'.underline.red + ' Interrupt again to confirm, may cause issues during firmware upload!'.yellow);
  }
});
