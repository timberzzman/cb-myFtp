const { Socket } = require('dgram');
const net = require('net');
const readline = require('readline')

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
  });
rl.setPrompt('>')
let host = process.argv[2]
let port = process.argv[3]
if (!port || !host) {
	console.log(`Usage: node client.js <host> <port>`)
	process.exit(1)
  }
var client = new net.Socket();
client.connect(port, host, function() {
	console.log('Connected to server');
});

client.on('data', function(data) {
	console.log(data.toString());
});

client.on('error', (data) => {
	console.log(data.toString())
	client.destroy()
	process.exit(0)
})

client.on('close', function() { 
	console.log('Connection closed');
});

rl.on('line', (input) => {
	let [directive, parameter] = input.toString().split(' ')

	if (directive === 'QUIT') {
		client.write('221')
		console.log('Closing connection')
		client.destroy()
		console.log('Closing client')
		process.exit(0)
	}
	else {
		client.write(input)
	}
  });