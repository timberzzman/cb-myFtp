const net = require('net')
const readline = require('readline')
const fs = require('fs')
let rs
let ws
let state = 0

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})
rl.setPrompt('myFtpClient ->')
const host = process.argv[2]
const port = process.argv[3]
if (!port || !host) {
  console.log('Usage: node client.js <host> <port>')
  process.exit(1)
}
const client = new net.Socket()
client.connect(port, host, function () {
  console.log('Connected to server')
  rl.prompt()
})

client.on('data', function (data) {
  if (data.toString().indexOf('\r\n') > -1) {
    const lines = data.toString().split('\r\n')
    for (const element of lines) {
      checkData(element)
    }
  } else {
    checkData(data)
  }
})

client.on('error', (data) => {
  console.log('Server disconnected. Closing client.')
  client.destroy()
  process.exit(0)
})

client.on('close', function () {
  console.log('Connection closed')
})

rl.on('line', (input) => {
  const [directive, parameter] = input.toString().split(' ')

  switch (directive) {
    case 'QUIT':
      client.write('221')
      console.log('Closing connection')
      client.destroy()
      console.log('Closing client')
      process.exit(0)
      break
    case 'RETR':
      client.write(`RETR ${parameter}`)
      break
    case 'STOR':
      STORCommand(client, parameter)
      break
    default:
      client.write(`${input}${parameter ? ' ' + parameter : ''}`)
      break
  }
})

function checkOK(data) {
  const [key, value] = data.split('|')
  switch (key) {
    case 'PATH':
      console.log(`change directory to ${value}`)
      break
    case 'COMMAND':
      console.log(value)
      break
    case 'LIST':
      console.log(value.replace(/;/g, ' '))
      break
    default:
      break
  }
}

function STORCommand (socket, file) {
  try {
    console.log(file)
    if (fs.existsSync(file)) {
      rs = fs.createReadStream(file)
      console.log('Contacting server for sending file')
      socket.write(`STOR ${file}`)
    }
    else {
      console.error('File doesn\'t exists.')
    }
  } catch (err) {
    console.error('There is a problem with checking the file.')
  }
}

function sendingFile (socket) {
  socket.write('150\r\n')
  rs.on('readable', () => {
    let data
    while (data = rs.read()) {
      socket.write(data)
    }
  })
  rs.on('end', () => {
    socket.write('\r\n226')
    console.log('File was send to the server')
  })
}

function checkData (data) {
  const [CODE, VALUE] = data.toString().split(' ')
  switch (CODE) {
    case '200':
      checkOK(VALUE)
      break
    case '331':
      console.log('User accepted. Need Password.')
      break
    case '230':
      console.log('Password accepted. You are connected.')
      state = 1
      break
    case '125':
      sendingFile(client)
      break
    case '150':
      ws = fs.createWriteStream(VALUE)
      state = 2
      console.log(`Start getting file ${VALUE}`)
      return
    case '226':
      ws.end()
      state = 1
      console.log('File is finished')
      break
    case '550':
      console.error("Error: File doesn't exist")
      break
    case '502':
      console.log('This command doesn\'t exist.')
      break
    default:
      if (state === 2) {
        ws.write(data)
      }
      break
  }
  if (state !== 2) {
    rl.prompt()
  }
}
